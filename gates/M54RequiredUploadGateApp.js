import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { File } from 'expo-file-system';
import {
  closeGatherStorage,
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  deleteFile,
  deleteProjectDirectory,
  ensureProjectDirectories,
  fileForKey,
  initializeGatherStorage,
  manifestFingerprintFor,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { buildSubmissionParts, toFormData } from 'odk-central-client';

import { loadBundledFlowerImageFixture } from './fixtures/bundledImageFixture.js';
import { createInstanceLifecycleService } from '../src/instances/instanceLifecycleService.js';

const GATE_PROJECT_KEY = 'm54a-required-upload-gate';
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>M5.4a required image</h:title><model>
    <instance><data id="m54a_required_image"><observation/><flower_photo/><meta><instanceID/></meta></data></instance>
    <bind nodeset="/data/observation" type="string" required="true()"/>
    <bind nodeset="/data/flower_photo" type="binary" required="true()"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/observation"><label>Observation</label></input>
    <upload ref="/data/flower_photo" mediatype="image/*"><label>Flower photo</label></upload>
  </h:body>
</h:html>`;

const valueFor = (snapshot, reference) => {
  const value = snapshot?.nodesByReference?.[reference]?.instanceValue ??
    snapshot?.nodesByReference?.[reference]?.value;
  return Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '');
};

const bytesEqual = (left, right) =>
  left?.byteLength === right?.byteLength && left.every((value, index) => value === right[index]);

const waitForEngine = () => new Promise((resolve) => setTimeout(resolve, 0));

const lifecycleFor = ({ instances, forms, captureSubmit }) =>
  createInstanceLifecycleService({
    instances,
    formCatalog: {
      async loadFormVersion(formVersionId) {
        const version = await forms.getVersion(formVersionId);
        return { version, xml: await readText(version.xmlFileKey), attachments: [] };
      },
    },
    credentials: { getProjectToken: async () => 'not-used-by-this-gate' },
    files: { readText, writeTextAtomic, writeBytesAtomic, fileForKey, deleteFile },
    createClient: () => ({
      submit: async (input) => {
        const parts = buildSubmissionParts(input);
        captureSubmit({
          ...input,
          parts,
          body: toFormData(parts),
        });
        return { status: 201, message: 'gate accepted' };
      },
    }),
    newLocalInstanceId: () => 'required-image-instance',
  });

export default function M54RequiredUploadGateApp() {
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
      console.log(`M54A_REQUIRED_UPLOAD_RESULT::${JSON.stringify(summary)}`);
    };
    const watchdog = setTimeout(() => finish({ error: 'gate timed out', checks: {} }), 120_000);
    let cancelled = false;

    const run = async () => {
      let database = null;
      try {
        let storage = await initializeGatherStorage();
        database = storage.database;
        let forms = createFormsRepository(database);
        let instances = createInstancesRepository(database);
        let projects = createProjectsRepository(database);
        if (await projects.getProject(GATE_PROJECT_KEY)) {
          await projects.deleteProject(GATE_PROJECT_KEY);
          deleteProjectDirectory(GATE_PROJECT_KEY);
        }
        await projects.upsertProject({
          projectKey: GATE_PROJECT_KEY,
          displayName: 'M5.4a required upload gate',
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(GATE_PROJECT_KEY);
        const xmlFileKey = `projects/${GATE_PROJECT_KEY}/forms/required-image/form.xml`;
        const version = await forms.recordCachedVersion({
          projectKey: GATE_PROJECT_KEY,
          formId: 'm54a_required_image',
          displayName: 'M5.4a required image',
          sourceVersion: '1',
          sourceHash: 'md5:m54a',
          manifestFingerprint: manifestFingerprintFor([]),
          xmlFileKey,
          manifestFileKey: `projects/${GATE_PROJECT_KEY}/forms/required-image/manifest.json`,
          resources: [],
        });
        await writeTextAtomic(xmlFileKey, FORM_XML);

        let submitInput = null;
        let lifecycle = lifecycleFor({
          instances,
          forms,
          captureSubmit: (input) => {
            submitInput = input;
          },
        });
        const project = {
          projectKey: GATE_PROJECT_KEY,
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        };

        await host.loadForm(FORM_XML);
        await host.setValue('/data/observation', 'required-upload gate');
        const renderModel = await host.getRenderModel();
        const upload = renderModel.nodes.find(
          (node) => node.nodeType === 'upload' && node.valueType === 'binary'
        );
        if (!upload || upload.mediaType !== 'image') {
          throw new Error('fixture did not materialize an image upload');
        }
        const source = await loadBundledFlowerImageFixture();
        const sourceBytes = await source.file.bytes();
        const bound = await lifecycle.attachImageMedia({
          project,
          form: { setValue: (reference, value) => host.setValue(reference, value), serialize: () => host.serialize() },
          version,
          reference: upload.reference,
          sourceFile: source.file,
          contentType: source.contentType,
        });
        const draftXml = await readText(bound.instance.xmlFileKey);
        const storedBytes = await readBytes(bound.media.fileKey);

        await host.loadForm(FORM_XML);
        const fresh = await host.getSnapshot();
        await closeGatherStorage();
        storage = await initializeGatherStorage();
        database = storage.database;
        forms = createFormsRepository(database);
        instances = createInstancesRepository(database);
        projects = createProjectsRepository(database);
        lifecycle = lifecycleFor({
          instances,
          forms,
          captureSubmit: (input) => {
            submitInput = input;
          },
        });
        const resumed = await lifecycle.resume({
          localInstanceId: bound.instance.localInstanceId,
          project,
          form: { loadInstance: (xml, instanceXml, attachments) => host.loadInstance(xml, instanceXml, attachments) },
        });
        await waitForEngine();
        const restored = await host.getSnapshot();
        const ready = await lifecycle.finalize({
          localInstanceId: bound.instance.localInstanceId,
          project,
          form: { serialize: () => host.serialize() },
          version: resumed.version,
        });
        const sent = await lifecycle.send({ localInstanceId: ready.localInstanceId, project });
        const submittedFile = submitInput?.attachments?.[0]?.data ?? null;
        const submittedBytes = submittedFile ? await submittedFile.bytes() : null;
        await projects.deleteProject(GATE_PROJECT_KEY);
        deleteProjectDirectory(GATE_PROJECT_KEY);
        const checks = {
          migrationApplied: storage.schemaVersion >= 6,
          engineRecognizesImageUpload: upload.mediaType === 'image' && upload.mediaAccept === 'image/*',
          fixtureBytesCopied: bytesEqual(sourceBytes, storedBytes) && storedBytes.byteLength > 0,
          xmlBindsExactFilename: draftXml.includes(`<flower_photo>${bound.media.filename}</flower_photo>`),
          metadataUsesRelativeMediaKey:
            bound.media.fileKey ===
            `projects/${GATE_PROJECT_KEY}/media/${bound.instance.localInstanceId}/${bound.media.filename}`,
          freshFormHasNoImage: valueFor(fresh, '/data/flower_photo') === '',
          resumedXmlKeepsFilename:
            valueFor(restored, '/data/flower_photo') === bound.media.filename &&
            resumed.media.length === 1 &&
            resumed.media[0].fileKey === bound.media.fileKey,
          requiredImageFinalizes: ready.state === 'ready',
          submitReceivesExpoFile:
            sent.ok === true &&
            submittedFile instanceof File &&
            submitInput.attachments[0].name === bound.media.filename &&
            bytesEqual(sourceBytes, submittedBytes),
          multipartBodyConstructed:
            submitInput?.parts?.length === 2 &&
            submitInput.parts[1].name === bound.media.filename &&
            submitInput.parts[1].body === submittedFile &&
            typeof submitInput.body?.append === 'function',
          projectRemovalCleansMedia:
            (await projects.getProject(GATE_PROJECT_KEY)) == null && !fileForKey(bound.media.fileKey).exists,
        };
        if (!cancelled) finish({ checks, filename: bound.media.filename, byteLength: storedBytes.byteLength });
      } catch (error) {
        if (!cancelled) finish({ error: error?.message ?? String(error), checks: {} });
      } finally {
        try {
          if (database) {
            await database.runAsync('DELETE FROM projects WHERE project_key = ?;', [GATE_PROJECT_KEY]);
          }
          deleteProjectDirectory(GATE_PROJECT_KEY);
          await closeGatherStorage();
        } catch {
          // Cleanup cannot hide a gate result.
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
      <Text style={styles.title}>M5.4a required image upload gate</Text>
      <Text style={styles.subtitle}>bundled bytes → XML filename → native multipart body</Text>
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
