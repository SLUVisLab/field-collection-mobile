import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { OdkCentralClient, createAppUserAuth } from './src/central/index.js';
import { WebViewXFormsHost } from './src/host/WebViewXFormsHost';
import { createWebViewSidecarHtml } from './src/host/createWebViewSidecarHtml';
import { XFormsProvider, useXForm } from './src/react';
import { LIVE_CONFIG } from './src/central/liveConfig.local.js';

const REG_FORM_ID = 'silphium_plant_registration';
const MAX_EVENTS = 80;
let scenarioRunStarted = false;
const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const shortId = () =>
  'xxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const snapshotValue = (snapshot, ref) => {
  const node = snapshot?.nodesByReference?.[ref] ?? null;
  if (node == null) return null;
  if (typeof node.instanceValue === 'string' && node.instanceValue.length > 0) return node.instanceValue;
  if (Array.isArray(node.value)) return node.value.map(String).join(' ');
  return node.value == null ? null : String(node.value);
};

// Extract the Entity create metadata from serialized submission XML.
const extractEntity = (xml) => {
  const block = xml.match(/<entity\b[\s\S]*?<\/entity>/i)?.[0] ?? '';
  const id = block.match(/\bid="([^"]*)"/i)?.[1] ?? null;
  const dataset = block.match(/\bdataset="([^"]*)"/i)?.[1] ?? null;
  const create = block.match(/\bcreate="([^"]*)"/i)?.[1] ?? null;
  const label = block.match(/<label>([\s\S]*?)<\/label>/i)?.[1] ?? null;
  return { id, dataset, create, label };
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
      console.log(`M465_RUNTIME_STEP_START::${name}`);
      pushEvent({ type: 'step-start', payload: { name } });
      try {
        const value = await op();
        steps.push({ name, ok: true });
        console.log(`M465_RUNTIME_STEP_OK::${name}`);
        return value;
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        steps.push({ name, ok: false, error: resolved.message });
        console.log(`M465_RUNTIME_STEP_FAIL::${name}::${resolved.message}`);
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

      const forms = await runStep(steps, 'listForms', () => client.listForms());
      const listing = forms.find((f) => f.formId === REG_FORM_ID);
      if (!listing) throw new Error(`form ${REG_FORM_ID} not visible`);
      const formXml = await runStep(steps, 'downloadForm', () =>
        client.downloadForm({ formId: REG_FORM_ID })
      );

      // Registration form has no external resources (no manifest).
      await runStep(steps, 'loadForm', () => latestFormRef.current.loadForm(formXml));
      await waitForTick();
      await waitForTick();

      // Deterministic, clearly test-specific, non-colliding values.
      const uniqueSite = `M46-${shortId()}`;
      const expected = {
        field_site: uniqueSite,
        block: 9,
        column: 9,
        row: 9,
        plant_location: '38.5242 -90.5582 0 5',
        status: 'active',
        // calculate="concat(field_site,'-B',block,'-C',column,'-R',row)"
        plant_code: `${uniqueSite}-B9-C9-R9`,
      };

      await runStep(steps, 'setValue:field_site', () =>
        latestFormRef.current.setValue('/data/field_site', expected.field_site)
      );
      await runStep(steps, 'setValue:block', () => latestFormRef.current.setValue('/data/block', 9));
      await runStep(steps, 'setValue:column', () => latestFormRef.current.setValue('/data/column', 9));
      await runStep(steps, 'setValue:row', () => latestFormRef.current.setValue('/data/row', 9));
      await runStep(steps, 'setValue:plant_location', () =>
        latestFormRef.current.setValue('/data/plant_location', expected.plant_location)
      );
      await runStep(steps, 'setValue:status', () =>
        latestFormRef.current.setValue('/data/status', expected.status)
      );
      await runStep(steps, 'refreshSnapshot', () => latestFormRef.current.refreshSnapshot('m4.6.5'));
      await waitForTick();
      await waitForTick();

      const snap = latestSnapshotRef.current;
      const derivedPlantCode = snapshotValue(snap, '/data/plant_code');

      const serializeResult = await runStep(steps, 'serialize', () => latestFormRef.current.serialize());
      const entity = extractEntity(serializeResult.xml ?? '');

      const submitResult = await runStep(steps, 'submitRegistration', () =>
        client.submit({ xml: serializeResult.xml })
      );

      if (cancelled) return;

      const checks = {
        formLoaded: latestPhaseRef.current === 'ready',
        plantCodeCalculated: derivedPlantCode === expected.plant_code,
        serializedEntityCreateBlock: entity.create === '1' && entity.dataset === 'plants',
        entityHasGeneratedUuid: typeof entity.id === 'string' && /[0-9a-f-]{36}/i.test(entity.id),
        entityLabelIsPlantCode: entity.label === expected.plant_code,
        submitSucceeded: submitResult?.status === 201,
      };

      const summary = {
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        durationMs: Date.now() - startedAt,
        form: { formId: listing.formId, version: listing.version },
        expected,
        derivedPlantCode,
        entity,
        submitResult,
        checks,
        stepOutcomes: steps,
        ok: steps.every((s) => s.ok) && Object.values(checks).every(Boolean),
      };

      clearTimeout(watchdog);
      setSummary(summary);
      pushEvent({ type: 'summary', payload: summary });
      console.log(
        `M465_RUNTIME_DONE::ok=${summary.ok}::entityId=${entity.id}::label=${entity.label}::status=${submitResult?.status}`
      );
      console.log(`M465_RUNTIME_RESULT::${JSON.stringify({ summary })}`);
    };

    const watchdog = setTimeout(() => {
      if (cancelled) return;
      console.log('M465_RUNTIME_HANG::' + JSON.stringify({ phase: latestPhaseRef.current }));
      setSummary({ platform: Platform.OS, ok: false, hang: true });
    }, 120000);

    run().catch((error) => {
      if (cancelled) return;
      clearTimeout(watchdog);
      const resolved = error instanceof Error ? error : new Error(String(error));
      console.log(`M465_RUNTIME_CRASH::${resolved.message}`);
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

export default function M465RegisterSlice() {
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
        <Text style={styles.title}>M4.6.5 Entity create (registration) gate</Text>
        <Text style={styles.detail}>Platform: {Platform.OS}</Text>
        {summary == null ? <Text style={styles.detail}>Running scenario...</Text> : null}
        {summary != null ? (
          <View style={styles.block}>
            <Text style={summary.ok ? styles.ok : styles.fail}>{summary.ok ? 'PASS' : 'FAIL'}</Text>
            <Text style={styles.detail}>Checks: {JSON.stringify(summary.checks ?? {})}</Text>
            <Text style={styles.detail}>Entity: {JSON.stringify(summary.entity ?? {})}</Text>
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
          key="m465-hidden-sidecar"
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
