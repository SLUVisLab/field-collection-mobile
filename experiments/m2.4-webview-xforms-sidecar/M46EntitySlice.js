import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

import { OdkCentralClient, createAppUserAuth } from './src/central/index.js';
import { WebViewXFormsHost } from './src/host/WebViewXFormsHost';
import { createWebViewSidecarHtml } from './src/host/createWebViewSidecarHtml';
import { XFormsProvider, useXForm } from './src/react';
import { LIVE_CONFIG } from './src/central/liveConfig.local.js';

const ENTITY_FORM_ID = 'silphium_flower_survey_entities';
const SELECT_REF = '/data/plant';
// calculate binds that read instance('plants')/root/item[name=/data/plant]/<prop>
const DERIVED = Object.freeze({
  '/data/field_site': 'site',
  '/data/block': 'block',
  '/data/column': 'column',
  '/data/row': 'row',
  '/data/plant_code': 'plant_code',
  '/data/entity_version': '__version',
});

const MAX_EVENTS = 80;
let scenarioRunStarted = false;
const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Minimal CSV parse (no quoted-field commas in this fixture) into {header, rows}. */
const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? '';
    });
    return row;
  });
  return { header, rows };
};

const snapshotValue = (snapshot, ref) => {
  const node = snapshot?.nodesByReference?.[ref] ?? null;
  if (node == null) return null;
  // calculates are string leaves; instanceValue is the serialized text.
  if (typeof node.instanceValue === 'string' && node.instanceValue.length > 0) return node.instanceValue;
  if (Array.isArray(node.value)) return node.value.map(String).join(' ');
  return node.value == null ? null : String(node.value);
};

const ScenarioRunner = ({ pushEvent, setSummary }) => {
  const form = useXForm();
  const latestFormRef = useRef(form);
  const latestSnapshotRef = useRef(form.snapshot);
  const latestPhaseRef = useRef(form.phase);
  latestFormRef.current = form;
  latestSnapshotRef.current = form.snapshot;
  latestPhaseRef.current = form.phase;

  useEffect(() => {
    if (scenarioRunStarted) return;
    scenarioRunStarted = true;
    let cancelled = false;

    const runStep = async (steps, name, op) => {
      console.log(`M464_RUNTIME_STEP_START::${name}`);
      pushEvent({ type: 'step-start', payload: { name } });
      try {
        const value = await op();
        steps.push({ name, ok: true });
        console.log(`M464_RUNTIME_STEP_OK::${name}`);
        return value;
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        steps.push({ name, ok: false, error: resolved.message });
        console.log(`M464_RUNTIME_STEP_FAIL::${name}::${resolved.message}`);
        throw resolved;
      }
    };

    const run = async () => {
      const steps = [];
      const startedAt = Date.now();
      const client = new OdkCentralClient({
        baseUrl: LIVE_CONFIG.baseUrl,
        projectId: LIVE_CONFIG.projectId,
        auth: createAppUserAuth(LIVE_CONFIG.appUserToken),
        timeoutMs: 45000,
      });

      // 1) Discover the Entity-aware form + its resources via the App User manifest.
      const forms = await runStep(steps, 'listForms', () => client.listForms());
      const listing = forms.find((f) => f.formId === ENTITY_FORM_ID);
      if (!listing) throw new Error(`form ${ENTITY_FORM_ID} not visible`);
      const manifest = await runStep(steps, 'getFormManifest', () =>
        client.getFormManifest({ formId: ENTITY_FORM_ID })
      );
      const entityList = manifest.find((e) => e.isEntityList);
      const staticMedia = manifest.find((e) => !e.isEntityList);
      if (!entityList) throw new Error('manifest has no entityList resource');

      // 2) Download resources by their manifest downloadUrls (App User token in path).
      const cache = FileSystem.cacheDirectory;
      const csvText = await runStep(steps, 'downloadPlantsCsv', async () => {
        const target = cache + 'plants.csv';
        await FileSystem.downloadAsync(entityList.downloadUrl, target);
        return FileSystem.readAsStringAsync(target, { encoding: 'utf8' });
      });
      const imageBase64 = staticMedia
        ? await runStep(steps, 'downloadStaticMedia', async () => {
            try {
              const target = cache + staticMedia.filename;
              await FileSystem.downloadAsync(staticMedia.downloadUrl, target);
              return await FileSystem.readAsStringAsync(target, { encoding: 'base64' });
            } catch (error) {
              // Best-effort: the engine tolerates a missing itext media label,
              // and the derived-property checks don't depend on the image.
              console.log(`M464_STATIC_MEDIA_SKIP::${error?.message ?? error}`);
              return null;
            }
          })
        : null;

      const formXml = await runStep(steps, 'downloadForm', () =>
        client.downloadForm({ formId: ENTITY_FORM_ID })
      );

      // 3) Load the form into the stock engine WITH the external resources.
      const attachments = [{ filename: 'plants.csv', contentType: 'text/csv', text: csvText }];
      if (staticMedia && imageBase64) {
        attachments.push({
          filename: staticMedia.filename,
          contentType: 'image/jpeg',
          base64: imageBase64,
        });
      }
      await runStep(steps, 'loadFormWithResources', () =>
        latestFormRef.current.loadForm(formXml, attachments)
      );
      await waitForTick();
      await waitForTick();

      // 4) The engine should have materialized select_one_from_file choices.
      const afterLoad = latestSnapshotRef.current;
      const selectNode = afterLoad?.nodesByReference?.[SELECT_REF] ?? null;
      const choices = Array.isArray(selectNode?.choices) ? selectNode.choices : [];
      const { rows } = parseCsv(csvText);
      const targetRow = rows[0];
      const targetUuid = targetRow.name;

      await runStep(steps, 'selectEntity', () =>
        latestFormRef.current.setValue(SELECT_REF, targetUuid)
      );
      await runStep(steps, 'refreshSnapshot', () =>
        latestFormRef.current.refreshSnapshot('m4.6.4')
      );
      await waitForTick();
      await waitForTick();

      const afterSelect = latestSnapshotRef.current;
      const selectedValue = snapshotValue(afterSelect, SELECT_REF);

      // 5) Compare engine-derived properties against the CSV row for the same UUID.
      const derived = {};
      const derivedChecks = {};
      for (const [ref, csvCol] of Object.entries(DERIVED)) {
        const got = snapshotValue(afterSelect, ref);
        derived[ref] = got;
        derivedChecks[ref] = got != null && String(got) === String(targetRow[csvCol]);
      }

      if (cancelled) return;

      const checks = {
        formLoaded: latestPhaseRef.current === 'ready',
        csvDelivered: typeof csvText === 'string' && csvText.startsWith('name,label,__version'),
        choicesMaterialized: choices.length === rows.length && rows.length > 0,
        selectedValueIsUuid:
          selectedValue === targetUuid && /^[0-9a-f-]{36}$/i.test(String(selectedValue)),
        derivedSite: derivedChecks['/data/field_site'] === true,
        derivedBlock: derivedChecks['/data/block'] === true,
        derivedColumn: derivedChecks['/data/column'] === true,
        derivedRow: derivedChecks['/data/row'] === true,
        derivedPlantCode: derivedChecks['/data/plant_code'] === true,
        derivedVersion: derivedChecks['/data/entity_version'] === true,
      };

      const summary = {
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        durationMs: Date.now() - startedAt,
        form: { formId: listing.formId, version: listing.version },
        manifest: {
          entityList: entityList.filename,
          entityListType: entityList.type,
          staticMedia: staticMedia ? staticMedia.filename : null,
        },
        choiceCount: choices.length,
        csvRowCount: rows.length,
        selectedUuid: targetUuid,
        selectedValue,
        expectedFromCsv: {
          site: targetRow.site,
          block: targetRow.block,
          column: targetRow.column,
          row: targetRow.row,
          plant_code: targetRow.plant_code,
          __version: targetRow.__version,
        },
        derived,
        checks,
        stepOutcomes: steps,
        ok: steps.every((s) => s.ok) && Object.values(checks).every(Boolean),
      };

      clearTimeout(watchdog);
      setSummary(summary);
      pushEvent({ type: 'summary', payload: summary });
      console.log(`M464_RUNTIME_DONE::ok=${summary.ok}::choices=${choices.length}::uuid=${targetUuid}`);
      console.log(`M464_RUNTIME_RESULT::${JSON.stringify({ summary })}`);
    };

    const watchdog = setTimeout(() => {
      if (cancelled) return;
      console.log('M464_RUNTIME_HANG::' + JSON.stringify({ phase: latestPhaseRef.current }));
      setSummary({ platform: Platform.OS, ok: false, hang: true });
    }, 120000);

    run().catch((error) => {
      if (cancelled) return;
      clearTimeout(watchdog);
      const resolved = error instanceof Error ? error : new Error(String(error));
      console.log(`M464_RUNTIME_CRASH::${resolved.message}`);
      setSummary({ platform: Platform.OS, ok: false, error: resolved.message });
      pushEvent({ type: 'scenario-crash', payload: { message: resolved.message } });
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, [pushEvent, setSummary]);

  return null;
};

export default function M46EntitySlice() {
  const webViewRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);

  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 30000 }), []);
  const sidecarHtml = useMemo(() => createWebViewSidecarHtml(), []);

  const pushEvent = useCallback((event) => {
    setEvents((prev) => {
      const next = [...prev, { ...event, timestamp: new Date().toISOString() }];
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }, []);

  const onMessage = useCallback((event) => host.handleWebViewMessage(event), [host]);

  return (
    <XFormsProvider host={host}>
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={styles.title}>M4.6.4 Entity external-resource gate</Text>
        <Text style={styles.detail}>Platform: {Platform.OS}</Text>
        {summary == null ? <Text style={styles.detail}>Running scenario...</Text> : null}
        {summary != null ? (
          <View style={styles.block}>
            <Text style={summary.ok ? styles.ok : styles.fail}>{summary.ok ? 'PASS' : 'FAIL'}</Text>
            <Text style={styles.detail}>Checks: {JSON.stringify(summary.checks ?? {})}</Text>
            <Text style={styles.detail}>Derived: {JSON.stringify(summary.derived ?? {})}</Text>
            {summary.error ? <Text style={styles.fail}>Error: {summary.error}</Text> : null}
          </View>
        ) : null}
        <View style={styles.block}>
          <Text style={styles.subtitle}>Recent events</Text>
          {events.map((event, i) => (
            <Text key={`${event.timestamp}-${i}`} style={styles.eventLine}>
              {event.timestamp} {event.type}: {JSON.stringify(event.payload)}
            </Text>
          ))}
        </View>
        <ScenarioRunner pushEvent={pushEvent} setSummary={setSummary} />
        <WebView
          ref={webViewRef}
          key="m464-hidden-sidecar"
          source={{ html: sidecarHtml }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          style={styles.hiddenWebView}
        />
        <StatusBar style="auto" />
      </ScrollView>
    </XFormsProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  container: { padding: 14 },
  title: { color: '#f9fafb', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  subtitle: { color: '#f9fafb', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  detail: { color: '#d1d5db', fontSize: 12, marginBottom: 6 },
  ok: { color: '#22c55e', fontSize: 13, marginBottom: 6, fontWeight: '700' },
  fail: { color: '#ef4444', fontSize: 13, marginBottom: 6, fontWeight: '700' },
  block: { marginTop: 10, marginBottom: 12, borderColor: '#374151', borderWidth: 1, borderRadius: 8, padding: 10 },
  eventLine: { color: '#9ca3af', fontSize: 11, marginBottom: 4 },
  hiddenWebView: { position: 'absolute', width: 1, height: 1, opacity: 0.01, top: 0, left: 0 },
});
