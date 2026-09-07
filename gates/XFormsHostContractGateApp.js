import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Isolated on-device gate for the M5 XForms host contract. It mounts the hidden
// WebView sidecar (stock @getodk/xforms-engine) and exercises the two contract
// additions end-to-end against the *real* engine:
//
//   1. getRenderModel()  — engine-derived, ordered render metadata
//      (labels / hints / control type / appearance / structural sequence).
//   2. loadInstance()    — restoring a previously serialized instance through
//      the engine's restoreInstance entrypoint (NOT a setValue replay).
//
// The proof that loadInstance is a genuine engine restore (and not a value
// replay) is that a FRESH loadForm/createInstance is blank, while loadInstance
// of the serialized XML brings the saved answers back. Run per gates/README.md;
// emits exactly one terminal marker plus crash/hang fail-safes.
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';

const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>M5 Host Contract</h:title>
    <model>
      <instance>
        <data id="m5contract">
          <name/>
          <fruit/>
          <meta><instanceID/></meta>
        </data>
      </instance>
      <bind nodeset="/data/name" type="string"/>
      <bind nodeset="/data/fruit" type="string"/>
      <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name"><label>Full name</label><hint>As on ID</hint></input>
    <select1 ref="/data/fruit" appearance="minimal">
      <label>Favorite fruit</label>
      <item><label>Apple</label><value>apple</value></item>
      <item><label>Banana</label><value>banana</value></item>
    </select1>
  </h:body>
</h:html>`;

const NAME_VALUE = 'Ada Lovelace';
const FRUIT_VALUE = 'banana';

const findNode = (renderModel, reference) =>
  (renderModel?.nodes ?? []).find((node) => node.reference === reference) ?? null;

async function runGate(host) {
  const steps = [];
  const record = (name, ok, detail) => {
    steps.push({ name, ok: Boolean(ok), detail: String(detail ?? '') });
  };

  // 1. Initialize the sidecar / engine.
  const init = await host.initialize();
  record('initialize engine', init && init.engineUrl != null, `wasm=${init && init.webAssemblyAvailable}`);

  // 2. Load the form fresh (createInstance path).
  const loaded = await host.loadForm(FORM_XML);
  record('loadForm success', loaded && loaded.loadStatus === 'success', `status=${loaded && loaded.loadStatus}`);

  // 3. Engine-derived render model: ordered metadata for native UI.
  const renderModel = await host.getRenderModel();
  const nameNode = findNode(renderModel, '/data/name');
  const fruitNode = findNode(renderModel, '/data/fruit');
  const nameIdx = (renderModel.nodes ?? []).findIndex((n) => n.reference === '/data/name');
  const fruitIdx = (renderModel.nodes ?? []).findIndex((n) => n.reference === '/data/fruit');

  record(
    'render model: control type + label + hint',
    nameNode && nameNode.nodeType === 'input' && nameNode.label === 'Full name' && nameNode.hint === 'As on ID',
    `type=${nameNode && nameNode.nodeType} label=${nameNode && nameNode.label} hint=${nameNode && nameNode.hint}`
  );
  record(
    'render model: select control type + appearance + choices',
    fruitNode &&
      fruitNode.nodeType === 'select' &&
      fruitNode.selectType === 'select1' &&
      Array.isArray(fruitNode.appearances) &&
      fruitNode.appearances.includes('minimal') &&
      Array.isArray(fruitNode.choices) &&
      fruitNode.choices.length === 2,
    `type=${fruitNode && fruitNode.nodeType} selectType=${fruitNode && fruitNode.selectType} appearances=${JSON.stringify(fruitNode && fruitNode.appearances)} choices=${fruitNode && fruitNode.choices && fruitNode.choices.length}`
  );
  record(
    'render model: structural sequence (name before fruit)',
    nameIdx >= 0 && fruitIdx >= 0 && nameIdx < fruitIdx,
    `nameIdx=${nameIdx} fruitIdx=${fruitIdx}`
  );

  // 4. Fill answers and serialize the instance.
  await host.setValue('/data/name', NAME_VALUE);
  await host.setValue('/data/fruit', FRUIT_VALUE);
  const serialized = await host.serialize();
  const instanceXml = serialized && serialized.xml;
  const serializedHasValues =
    typeof instanceXml === 'string' && instanceXml.includes(NAME_VALUE) && instanceXml.includes(FRUIT_VALUE);
  record('serialize captures filled values', serializedHasValues, `len=${instanceXml ? instanceXml.length : 0}`);

  // 5. Prove a fresh load is blank (baseline for the restore assertion).
  const fresh = await host.loadForm(FORM_XML);
  const freshName = fresh.snapshot.nodesByReference['/data/name'];
  record(
    'fresh createInstance is blank',
    freshName && (freshName.value == null || freshName.value === '' || (Array.isArray(freshName.value) && freshName.value.length === 0)),
    `freshName=${JSON.stringify(freshName && freshName.value)}`
  );

  // 6. Restore the serialized instance via the engine restoreInstance entrypoint.
  const restored = await host.loadInstance(FORM_XML, instanceXml);
  const restoredName = restored.snapshot.nodesByReference['/data/name'];
  const restoredFruit = restored.snapshot.nodesByReference['/data/fruit'];
  record(
    'loadInstance restores serialized answers (engine restore, not setValue replay)',
    restored.mode === 'restore' &&
      restoredName &&
      String(restoredName.value) === NAME_VALUE &&
      restoredFruit &&
      Array.isArray(restoredFruit.value) &&
      restoredFruit.value.includes(FRUIT_VALUE),
    `mode=${restored.mode} name=${JSON.stringify(restoredName && restoredName.value)} fruit=${JSON.stringify(restoredFruit && restoredFruit.value)}`
  );

  return steps;
}

export default function XFormsHostContractGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 30000 }), []);
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () =>
      createSidecarWebViewProps({
        html,
        onMessage: (event) => host.handleWebViewMessage(event),
      }),
    [html, host]
  );

  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const watchdog = setTimeout(() => {
      console.log('M5_HOST_CONTRACT_HANG::' + JSON.stringify({ platform: Platform.OS }));
    }, 90000);
    (async () => {
      try {
        const result = await runGate(host);
        setSteps(result);
        const passed = result.filter((s) => s.ok).length;
        const failed = result.length - passed;
        const s = { platform: Platform.OS, total: result.length, passed, failed, ok: failed === 0 };
        setSummary(s);
        console.log('M5_HOST_CONTRACT_RESULT::' + JSON.stringify({ ...s, steps: result }));
      } catch (e) {
        console.log(
          'M5_HOST_CONTRACT_CRASH::' +
            JSON.stringify({ platform: Platform.OS, error: e && e.message ? e.message : String(e) })
        );
      } finally {
        clearTimeout(watchdog);
        host.dispose().catch(() => {});
      }
    })();
    return () => clearTimeout(watchdog);
  }, [host]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>XForms host contract gate</Text>
      <Text style={styles.subtitle}>{Platform.OS}</Text>
      {summary && (
        <Text style={[styles.badge, summary.ok ? styles.badgeOk : styles.badgeFail]}>
          {summary.ok ? 'PASS' : 'FAIL'} · {summary.passed}/{summary.total}
        </Text>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {steps.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.mark, s.ok ? styles.ok : styles.fail]}>{s.ok ? '✓' : '✗'}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{s.name}</Text>
              <Text style={styles.rowDetail}>{s.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {/* Hidden sidecar running the stock engine. */}
      <WebView ref={webViewRef} {...webViewProps} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1b1b1f' },
  subtitle: { marginTop: 2, fontSize: 14, color: '#5a5a63' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  badgeOk: { backgroundColor: '#1a7f37' },
  badgeFail: { backgroundColor: '#cf222e' },
  scroll: { marginTop: 16, flex: 1 },
  scrollContent: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  mark: { width: 22, fontSize: 16, fontWeight: '700' },
  ok: { color: '#1a7f37' },
  fail: { color: '#cf222e' },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, color: '#1b1b1f' },
  rowDetail: { fontSize: 12, color: '#8a8a92' },
});
