import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  GatherPaths,
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  deleteFile,
  deleteProjectDirectory,
  ensureProjectDirectories,
  initializeGatherStorage,
  manifestFingerprintFor,
  readText,
  writeTextAtomic,
} from 'gather-storage';
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';

import { createInstanceLifecycleService } from '../src/instances/instanceLifecycleService.js';

const GATE_PROJECT_KEY = 'm54-lifecycle-gate';
const ENTITY_ID = '0ede576e-04a4-4266-8450-6d9a8cd24164';
const PLANTS_CSV = `name,label,__version
${ENTITY_ID},Tyson-A-C1-R2,1`;
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>M5.4 lifecycle</h:title><model>
    <instance><data id="m54_lifecycle"><plant/><flower_count/><observations><observation><note/></observation></observations><meta><instanceID/></meta></data></instance>
    <instance id="plants" src="jr://file-csv/plants.csv"/>
    <bind nodeset="/data/plant" type="string" required="true()"/>
    <bind nodeset="/data/flower_count" type="int" required="true()" constraint=". >= 0"/>
    <bind nodeset="/data/observations/observation/note" type="string"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <select1 ref="/data/plant"><label>Plant</label><itemset nodeset="instance('plants')/root/item"><value ref="name"/><label ref="label"/></itemset></select1>
    <input ref="/data/flower_count"><label>Flower count</label></input>
    <repeat nodeset="/data/observations/observation"><input ref="note"><label>Repeat note</label></input></repeat>
  </h:body>
</h:html>`;

const waitForEngine = () => new Promise((resolve) => setTimeout(resolve, 0));
const stateValue = (snapshot, reference) => {
  const node = snapshot?.nodesByReference?.[reference];
  const value = node?.instanceValue ?? node?.value;
  return Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '');
};

export default function M54InstanceLifecycleGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 45_000 }), []);
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () => createSidecarWebViewProps({ html, onMessage: (event) => host.handleWebViewMessage(event) }),
    [html, host]
  );
  const [result, setResult] = useState(null);
  const emitted = useRef(false);

  useEffect(() => {
    const finish = (payload) => {
      if (emitted.current) return;
      emitted.current = true;
      const ok = !payload.error && Object.values(payload.checks).every(Boolean);
      const summary = { platform: Platform.OS, ok, ...payload };
      setResult(summary);
      console.log(`M54_INSTANCE_LIFECYCLE_RESULT::${JSON.stringify(summary)}`);
    };
    const watchdog = setTimeout(() => finish({ error: 'gate timed out', checks: {} }), 90_000);
    let cancelled = false;

    const run = async () => {
      let database;
      let instances;
      let draft = null;
      try {
        const storage = await initializeGatherStorage();
        database = storage.database;
        const projects = createProjectsRepository(database);
        const forms = createFormsRepository(database);
        instances = createInstancesRepository(database);
        await projects.upsertProject({
          projectKey: GATE_PROJECT_KEY,
          displayName: 'M5.4 lifecycle gate',
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(GATE_PROJECT_KEY);
        const xmlFileKey = GatherPaths.forms(GATE_PROJECT_KEY, 'fixture', 'v1', 'form.xml');
        const csvFileKey = GatherPaths.resources(GATE_PROJECT_KEY, 'fixture', 'v1', 'plants.csv');
        const manifestFileKey = GatherPaths.forms(GATE_PROJECT_KEY, 'fixture', 'v1', 'manifest.json');
        const fingerprint = manifestFingerprintFor([
          { filename: 'plants.csv', hash: 'entity-v1', type: 'entityList', isEntityList: true },
        ]);
        await writeTextAtomic(xmlFileKey, FORM_XML);
        await writeTextAtomic(csvFileKey, PLANTS_CSV);
        await writeTextAtomic(manifestFileKey, JSON.stringify({ resources: ['plants.csv'] }));
        const version = await forms.recordCachedVersion({
          projectKey: GATE_PROJECT_KEY,
          formId: 'm54_lifecycle',
          displayName: 'M5.4 lifecycle',
          sourceVersion: '1',
          sourceHash: 'md5:m54',
          manifestFingerprint: fingerprint,
          xmlFileKey,
          manifestFileKey,
          resources: [
            {
              filename: 'plants.csv',
              hash: 'entity-v1',
              type: 'entityList',
              isEntityList: true,
              contentType: 'text/csv',
              fileKey: csvFileKey,
            },
          ],
        });
        const formCatalog = {
          async loadFormVersion(formVersionId) {
            const exact = await forms.getVersion(formVersionId);
            return {
              version: exact,
              xml: await readText(exact.xmlFileKey),
              attachments: exact.resources.map((resource) => ({
                filename: resource.filename,
                contentType: resource.contentType,
                text: PLANTS_CSV,
              })),
            };
          },
        };
        const lifecycle = createInstanceLifecycleService({
          instances,
          formCatalog,
          credentials: { getProjectToken: async () => 'not-used-by-this-gate' },
          files: { readText, writeTextAtomic, deleteFile },
          createClient: () => ({ submit: async () => ({ status: 201, message: 'not-used' }) }),
          newLocalInstanceId: () => 'gate-instance',
        });
        const project = {
          projectKey: GATE_PROJECT_KEY,
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        };

        await host.loadForm(FORM_XML, [{ filename: 'plants.csv', contentType: 'text/csv', text: PLANTS_CSV }]);
        await host.setValue('/data/plant', ENTITY_ID);
        await host.setValue('/data/flower_count', '2');
        await host.addRepeat('/data/observations/observation');
        await waitForEngine();
        const withRepeats = await host.getSnapshot();
        const noteReferences = Object.keys(withRepeats.nodesByReference).filter((reference) =>
          /^\/data\/observations\/observation\[\d+\]\/note$/.test(reference)
        );
        for (const [index, reference] of noteReferences.entries()) {
          await host.setValue(reference, `note-${index + 1}`);
        }
        const serialized = await host.serialize();
        draft = await lifecycle.saveDraft({
          project,
          form: { serialize: () => host.serialize() },
          version,
        });
        const persistedXml = await readText(draft.xmlFileKey);
        const fresh = await host.loadForm(FORM_XML, [
          { filename: 'plants.csv', contentType: 'text/csv', text: PLANTS_CSV },
        ]);
        const freshBlank = stateValue(fresh.snapshot, '/data/flower_count') === '';
        const resumed = await lifecycle.resume({
          localInstanceId: draft.localInstanceId,
          project,
          form: { loadInstance: (xml, instanceXml, attachments) => host.loadInstance(xml, instanceXml, attachments) },
        });
        const restored = await host.getSnapshot();
        const restoredNotes = Object.keys(restored.nodesByReference)
          .filter((reference) => /^\/data\/observations\/observation\[\d+\]\/note$/.test(reference))
          .map((reference) => stateValue(restored, reference));
        const checks = {
          migrationApplied: storage.schemaVersion >= 4,
          authoritativeXmlWritten: persistedXml === serialized.xml,
          metadataStoresExactVersion:
            draft.formVersionId === version.formVersionId &&
            draft.formVersion === '1' &&
            draft.formHash === 'md5:m54',
          freshEngineIsBlank: freshBlank,
          restoredThroughPublicLoadInstance:
            stateValue(restored, '/data/plant') === ENTITY_ID &&
            stateValue(restored, '/data/flower_count') === '2',
          repeatBindingsPersisted: noteReferences.length === 2 && restoredNotes.includes('note-1') && restoredNotes.includes('note-2'),
          instanceIdPersisted: draft.odkInstanceId === resumed.instance.odkInstanceId && draft.odkInstanceId.startsWith('uuid:'),
        };
        if (!cancelled) finish({ checks, repeatCount: restoredNotes.length });
      } catch (error) {
        if (!cancelled) finish({ error: error?.message ?? String(error), checks: {} });
      } finally {
        try {
          if (draft && draft.state === 'draft') await instances.removeDraft(draft.localInstanceId);
          if (database) await database.runAsync('DELETE FROM projects WHERE project_key = ?;', [GATE_PROJECT_KEY]);
          deleteProjectDirectory(GATE_PROJECT_KEY);
        } catch {
          // Gate cleanup never hides its lifecycle result.
        }
        host.dispose().catch(() => {});
      }
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      host.dispose().catch(() => {});
    };
  }, [host]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M5.4 instance lifecycle gate</Text>
      <Text style={styles.subtitle}>durable XML → fresh engine → public restore</Text>
      <ScrollView>{result ? <Text style={result.ok ? styles.ok : styles.fail}>{JSON.stringify(result)}</Text> : null}</ScrollView>
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
