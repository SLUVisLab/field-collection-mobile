import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  GatherPaths,
  deleteProjectDirectory,
  ensureProjectDirectories,
  initializeGatherStorage,
  readText,
  writeTextAtomic,
} from 'gather-storage';

import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { XFormsProvider, useXForm, useXFormsRenderModel } from 'odk-xforms-react';

const PLANTS_CSV = `name,label,__version,site,block,column,row,plant_code
0ede576e-04a4-4266-8450-6d9a8cd24164,Tyson-A-C1-R2,1,Tyson,A,1,2,Tyson-A-C1-R2
7376ad33-c362-40d9-b657-be0a14649131,Tyson-A-C1-R1,2,Tyson,A,1,1,Tyson-A-C1-R1`;

// Fixture mirrors the cached Entity List contract: the CSV is handed to the
// engine as a generic form attachment, not fetched by the sidecar.
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>M5.3 Cached Plants</h:title>
    <model>
      <instance>
        <data id="cached_plants">
          <plant/><field_site/><block/><plant_code/><flower_head_count/><plant_height_cm/>
          <meta><instanceID/></meta>
        </data>
      </instance>
      <instance id="plants" src="jr://file-csv/plants.csv"/>
      <bind nodeset="/data/plant" type="string" required="true()"/>
      <bind nodeset="/data/field_site" type="string" calculate="instance('plants')/root/item[name = /data/plant]/site"/>
      <bind nodeset="/data/block" type="string" calculate="instance('plants')/root/item[name = /data/plant]/block"/>
      <bind nodeset="/data/plant_code" type="string" calculate="instance('plants')/root/item[name = /data/plant]/plant_code"/>
      <bind nodeset="/data/flower_head_count" type="int" required="true()" constraint=". >= 0"/>
      <bind nodeset="/data/plant_height_cm" type="decimal" required="true()" constraint=". >= 0"/>
      <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
    </model>
  </h:head>
  <h:body>
    <group ref="/data"><label>Observation</label>
      <select1 ref="/data/plant"><label>Select Plant</label>
        <itemset nodeset="instance('plants')/root/item"><value ref="name"/><label ref="label"/></itemset>
      </select1>
      <input ref="/data/field_site"><label>Site</label></input>
      <input ref="/data/flower_head_count"><label>Flower heads</label></input>
      <input ref="/data/plant_height_cm"><label>Plant height</label></input>
    </group>
  </h:body>
</h:html>`;

const target = {
  uuid: '0ede576e-04a4-4266-8450-6d9a8cd24164',
  site: 'Tyson',
  block: 'A',
  plantCode: 'Tyson-A-C1-R2',
};
const GATE_PROJECT_KEY = 'm53-gate-fixture';

const waitForRender = () => new Promise((resolve) => setTimeout(resolve, 0));

function GateScenario({ cached, onComplete }) {
  const form = useXForm();
  const renderModel = useXFormsRenderModel();
  const latest = useRef({ form, renderModel });
  const started = useRef(false);
  latest.current = { form, renderModel };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    const run = async () => {
      await latest.current.form.loadForm(cached.xml, cached.attachments);
      await waitForRender();
      await waitForRender();
      const before = latest.current.form.snapshot;
      const plantRenderNode = (latest.current.renderModel?.nodes ?? []).find(
        (node) => node.reference === '/data/plant'
      );
      const choices = before?.nodesByReference?.['/data/plant']?.choices ?? [];
      await latest.current.form.setValue('/data/plant', target.uuid);
      await waitForRender();
      await waitForRender();
      const after = latest.current.form.snapshot?.nodesByReference ?? {};
      const asText = (reference) => {
        const value = after[reference]?.instanceValue ?? after[reference]?.value;
        return Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '');
      };
      const checks = {
        ...cached.storageChecks,
        csvAttached: PLANTS_CSV.startsWith('name,label,__version'),
        choicesFromAttachment: choices.length === 2 && choices.some((choice) => choice.value === target.uuid),
        renderModelChoices: Array.isArray(plantRenderNode?.choices) && plantRenderNode.choices.length === 2,
        selectedUuid: asText('/data/plant') === target.uuid,
        engineCalculatedSite: asText('/data/field_site') === target.site,
        engineCalculatedBlock: asText('/data/block') === target.block,
        engineCalculatedPlantCode: asText('/data/plant_code') === target.plantCode,
      };
      if (!cancelled) onComplete({ checks, choiceCount: choices.length, selectedUuid: asText('/data/plant') });
    };
    run().catch((error) => {
      if (!cancelled) onComplete({ error: error?.message ?? String(error), checks: {} });
    });
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return null;
}

export default function M53CatalogRunnerGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 45_000 }), []);
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () => createSidecarWebViewProps({ html, onMessage: (event) => host.handleWebViewMessage(event) }),
    [html, host]
  );
  const [result, setResult] = useState(null);
  const [cached, setCached] = useState(null);
  const emitted = useRef(false);

  const finish = (payload) => {
    if (emitted.current) return;
    emitted.current = true;
    // This fixture deliberately exercises the real durable cache, then leaves
    // no gate project behind on the emulator.
    deleteProjectDirectory(GATE_PROJECT_KEY);
    const ok = !payload.error && Object.values(payload.checks).every(Boolean);
    const summary = { platform: Platform.OS, ok, ...payload };
    setResult(summary);
    console.log(`M53_CATALOG_RUNNER_RESULT::${JSON.stringify(summary)}`);
  };

  useEffect(() => {
    const watchdog = setTimeout(() => {
      finish({ error: 'gate timed out', checks: {} });
    }, 90_000);
    return () => {
      clearTimeout(watchdog);
      host.dispose().catch(() => {});
    };
  }, [host]);

  useEffect(() => {
    let cancelled = false;
    const cacheFixture = async () => {
      try {
        const storage = await initializeGatherStorage();
        ensureProjectDirectories(GATE_PROJECT_KEY);
        const xmlKey = GatherPaths.forms(GATE_PROJECT_KEY, 'fixture', 'version-1', 'form.xml');
        const manifestKey = GatherPaths.forms(GATE_PROJECT_KEY, 'fixture', 'version-1', 'manifest.json');
        const csvKey = GatherPaths.resources(GATE_PROJECT_KEY, 'fixture', 'version-1', 'plants.csv');
        await writeTextAtomic(xmlKey, FORM_XML);
        await writeTextAtomic(
          manifestKey,
          JSON.stringify({
            formId: 'cached_plants',
            resources: [{ filename: 'plants.csv', isEntityList: true, hash: 'fixture-token' }],
          })
        );
        await writeTextAtomic(csvKey, PLANTS_CSV);
        const [xml, manifest, csv] = await Promise.all([
          readText(xmlKey),
          readText(manifestKey),
          readText(csvKey),
        ]);
        if (cancelled) return;
        setCached({
          xml,
          attachments: [{ filename: 'plants.csv', contentType: 'text/csv', text: csv }],
          storageChecks: {
            migrationApplied: storage.schemaVersion >= 3,
            durableXmlAndManifest: xml === FORM_XML && JSON.parse(manifest).resources[0].filename === 'plants.csv',
            durablePlantsCsv: csv === PLANTS_CSV,
          },
        });
      } catch (error) {
        if (!cancelled) finish({ error: error?.message ?? String(error), checks: {} });
      }
    };
    void cacheFixture();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M5.3 catalog runner gate</Text>
      <Text style={styles.subtitle}>Cached plants.csv → choices → engine calculations</Text>
      <ScrollView>
        {result ? <Text style={result.ok ? styles.ok : styles.fail}>{JSON.stringify(result)}</Text> : null}
      </ScrollView>
      {cached ? (
        <XFormsProvider host={host}>
          <GateScenario cached={cached} onComplete={finish} />
        </XFormsProvider>
      ) : null}
      <WebView ref={webViewRef} {...webViewProps} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 20, paddingTop: 64 },
  title: { color: '#1b1b1f', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#5a5a63', marginTop: 4 },
  ok: { color: '#1a7f37', marginTop: 20 },
  fail: { color: '#cf222e', marginTop: 20 },
});
