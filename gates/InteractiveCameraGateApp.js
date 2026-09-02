import { StatusBar } from 'expo-status-bar';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  deleteFile,
  deleteProjectDirectory,
  ensureProjectDirectories,
  fileForKey,
  initializeGatherStorage,
  manifestFingerprintFor,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';
import { XFormsProvider, useXForm } from 'odk-xforms-react';
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { buildSubmissionParts, toFormData } from 'odk-central-client';

import { createInstanceLifecycleService } from '../src/instances/instanceLifecycleService.js';
import { XFormsRenderer } from '../src/xforms/XFormsRenderer.js';

/**
 * Interactive camera gate — the one surface no headless gate can reach.
 *
 * `CollectionFieldGateApp` proves the *pipeline* (appearance -> repeat -> media
 * -> resume -> submit) but renders no React, so it cannot see the React binding
 * seam or the camera interaction. This mounts the **real** stack —
 * `XFormsProvider` + `XFormsRenderer` + `XFormsMultiImageControl` +
 * `MultiImageCapture` + `CameraView` — over real storage and the real
 * lifecycle service, and asks a human to drive it.
 *
 * It exists because that seam was actually broken: the control read
 * `repeat.instanceReferences` while `useXFormsRepeat` returns `instances`, so a
 * rendered collection was unconditionally empty. Both automated layers missed
 * it — the unit tests never mount the hook, and the headless gate reads the
 * snapshot directly. See docs/components-capabilities-ownership.md §21.
 *
 * The three **derived** rows below are machine-checked and must agree: tiles
 * projected == media rows == `<frame>` elements in the authoritative XML. The
 * **observed** rows are the human's, because nothing else can judge whether a
 * preview is live or a shutter feels responsive.
 *
 * Central is never contacted; the transport is stubbed.
 */
const GATE_PROJECT_KEY = 'interactive-camera-gate';
const PHOTOS = '/data/photos';

// The image child is `frame`, not `photo` — the author names it, and a fixture
// that matches a hardcoded default cannot constrain one. See b-standard §4.
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Interactive camera gate</h:title><model>
    <instance><data id="interactive_camera_gate">
      <photos jr:template=""><frame/></photos>
      <meta><instanceID/></meta>
    </data></instance>
    <bind nodeset="/data/photos/frame" type="binary"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <group ref="/data/photos">
      <label>Photos</label>
      <repeat nodeset="/data/photos" appearance="gather-multi-image min=2 max=4">
        <upload ref="/data/photos/frame" mediatype="image/*"><label>Photo</label></upload>
      </repeat>
    </group>
  </h:body>
</h:html>`;

/** The observations only a person looking at the screen can make. */
const OBSERVATIONS = [
  ['preview', 'Camera preview is live (not black/frozen)'],
  ['shutter', 'Shutter responds and returns to the collection'],
  ['thumbnail', 'Thumbnail accessory shows the photo just taken'],
  ['gallery', 'Gallery opens and navigates between photos'],
  ['remove', 'Removing a photo drops that tile, not another'],
  ['replace', 'Capture -> remove -> capture again works'],
  ['count', 'Count label tracks min=2 / max=4 and blocks a 5th'],
];

function Harness() {
  const form = useXForm();
  const { loadForm } = form;
  const services = useRef(null);
  const [status, setStatus] = useState('starting');
  const [media, setMedia] = useState([]);
  const [localInstanceId, setLocalInstanceId] = useState(null);
  const [xmlFrameCount, setXmlFrameCount] = useState(null);
  const [observed, setObserved] = useState({});
  const [message, setMessage] = useState(null);
  const [emitted, setEmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setStatus('opening storage');
        const storage = await initializeGatherStorage();
        const forms = createFormsRepository(storage.database);
        const instances = createInstancesRepository(storage.database);
        const projects = createProjectsRepository(storage.database);

        // A fresh draft every launch, so a rerun is never confused by the last.
        if (await projects.getProject(GATE_PROJECT_KEY)) {
          await projects.deleteProject(GATE_PROJECT_KEY);
          deleteProjectDirectory(GATE_PROJECT_KEY);
        }
        await projects.upsertProject({
          projectKey: GATE_PROJECT_KEY,
          displayName: 'Interactive camera gate',
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(GATE_PROJECT_KEY);
        const xmlFileKey = `projects/${GATE_PROJECT_KEY}/forms/interactive/form.xml`;
        const version = await forms.recordCachedVersion({
          projectKey: GATE_PROJECT_KEY,
          formId: 'interactive_camera_gate',
          displayName: 'Interactive camera gate',
          sourceVersion: '1',
          sourceHash: 'md5:interactivecamera',
          manifestFingerprint: manifestFingerprintFor([]),
          xmlFileKey,
          manifestFileKey: `projects/${GATE_PROJECT_KEY}/forms/interactive/manifest.json`,
          resources: [],
        });
        await writeTextAtomic(xmlFileKey, FORM_XML);

        const project = {
          projectKey: GATE_PROJECT_KEY,
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        };
        const lifecycle = createInstanceLifecycleService({
          instances,
          formCatalog: {
            async loadFormVersion(formVersionId) {
              const found = await forms.getVersion(formVersionId);
              return { version: found, xml: await readText(found.xmlFileKey), attachments: [] };
            },
          },
          credentials: { getProjectToken: async () => 'not-used-by-this-gate' },
          files: { readText, writeTextAtomic, writeBytesAtomic, fileForKey, deleteFile },
          createClient: () => ({
            submit: async (input) => {
              buildSubmissionParts(input);
              return { status: 201, message: 'gate accepted' };
            },
          }),
        });
        services.current = { instances, lifecycle, project, version };

        setStatus('loading form');
        await loadForm(FORM_XML);
        if (!cancelled) setStatus('ready — drive the control below');
      } catch (error) {
        if (!cancelled) {
          setStatus('failed');
          setMessage(error?.message ?? String(error));
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadForm]);

  /** Re-reads the two durable sides so the derived checks stay honest. */
  const refresh = useCallback(async (instanceId) => {
    const held = services.current;
    if (!held || !instanceId) return;
    const rows = await held.instances.listMedia(instanceId);
    setMedia(rows);
    try {
      const instance = await held.instances.get(instanceId);
      const xml = instance?.xmlFileKey ? await readText(instance.xmlFileKey) : '';
      setXmlFrameCount((xml.match(/<frame>/g) ?? []).length);
    } catch {
      setXmlFrameCount(null);
    }
  }, []);

  const onCapture = useCallback(
    async (reference, capture) => {
      const held = services.current;
      if (!held) throw new Error('storage is not ready');
      if (typeof capture?.uri !== 'string') throw new Error('the capture had no local uri');
      const sourceFile = new File(capture.uri);
      if (!sourceFile.exists) throw new Error('the captured image is unavailable');
      const bound = await held.lifecycle.attachImageMedia({
        localInstanceId,
        project: held.project,
        form: { setValue: form.setValue, serialize: form.serialize },
        version: held.version,
        reference,
        sourceFile,
        contentType: capture.contentType,
      });
      setLocalInstanceId(bound.instance.localInstanceId);
      await refresh(bound.instance.localInstanceId);
      return bound;
    },
    [form.serialize, form.setValue, localInstanceId, refresh]
  );

  const onRemove = useCallback(
    async (filenames) => {
      const held = services.current;
      if (!held || !localInstanceId) return;
      await held.lifecycle.releaseInstanceMedia({
        localInstanceId,
        project: held.project,
        form: { setValue: form.setValue, serialize: form.serialize },
        version: held.version,
        filenames,
      });
      await refresh(localInstanceId);
    },
    [form.serialize, form.setValue, localInstanceId, refresh]
  );

  const collection = useMemo(
    () => ({
      media,
      uriFor: (fileKey) => fileForKey(fileKey)?.uri ?? null,
      onCapture,
      onRemove,
    }),
    [media, onCapture, onRemove]
  );

  // Counted from the live engine snapshot, independently of the media table and
  // of the saved XML, so the three sides can genuinely disagree — and be seen
  // to. Equality across them is the whole invariant: what the engine holds,
  // what is durable, and what would be submitted.
  const engineFilled = Object.entries(form.snapshot?.nodesByReference ?? {}).filter(
    ([reference, entry]) =>
      reference.startsWith(`${PHOTOS}[`) &&
      entry?.valueType === 'binary' &&
      typeof entry?.instanceValue === 'string' &&
      entry.instanceValue.length > 0
  ).length;
  const derived = {
    engineMatchesMediaRows: engineFilled === media.length,
    engineMatchesSavedXml: engineFilled === xmlFrameCount,
    capturedAtLeastTwo: media.length >= 2,
  };

  const emit = () => {
    const checks = {
      ...Object.fromEntries(OBSERVATIONS.map(([key]) => [key, observed[key] === true])),
      ...derived,
    };
    const summary = {
      platform: Platform.OS,
      ok: Object.values(checks).every(Boolean),
      checks,
      mediaRows: media.length,
      xmlFrameCount,
      filenames: media.map((row) => row.filename),
    };
    setEmitted(true);
    console.log(`INTERACTIVE_CAMERA_RESULT::${JSON.stringify(summary)}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.title}>Interactive camera gate</Text>
      <Text style={styles.status}>{status}</Text>
      {message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>derived (must agree)</Text>
        <Text style={styles.mono}>engine (filled frames): {engineFilled}</Text>
        <Text style={styles.mono}>media rows: {media.length}</Text>
        <Text style={styles.mono}>&lt;frame&gt; in saved XML: {xmlFrameCount ?? '—'}</Text>
        <Text style={styles.mono}>
          all three agree:{' '}
          {String(derived.engineMatchesMediaRows && derived.engineMatchesSavedXml)}
        </Text>
      </View>

      {form.ready ? (
        <XFormsRenderer collection={collection} />
      ) : (
        <Text style={styles.status}>waiting for the engine…</Text>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>observed — tap each once true</Text>
        {OBSERVATIONS.map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setObserved((prev) => ({ ...prev, [key]: !prev[key] }))}
            style={styles.check}
            testID={`observe-${key}`}
          >
            <Text style={styles.checkBox}>{observed[key] ? '[x]' : '[ ]'}</Text>
            <Text style={styles.checkLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={emit} style={styles.emit} testID="emit-result">
        <Text style={styles.emitLabel}>{emitted ? 'Emitted — tap to re-emit' : 'Emit result'}</Text>
      </Pressable>
      <Text style={styles.footnote}>
        Emitting logs INTERACTIVE_CAMERA_RESULT:: once. Central is never contacted.
      </Text>
    </ScrollView>
  );
}

export default function InteractiveCameraGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 45_000 }), []);
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () => createSidecarWebViewProps({ html, onMessage: (event) => host.handleWebViewMessage(event) }),
    [html, host]
  );

  return (
    <View style={styles.root}>
      <XFormsProvider host={host}>
        <Harness />
      </XFormsProvider>
      <View style={styles.hidden} pointerEvents="none">
        <WebView ref={webViewRef} {...webViewProps} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  title: { color: '#e8eaed', fontSize: 18, fontWeight: '700' },
  status: { color: '#7b8794', fontSize: 12 },
  error: { color: '#ff6b6b', fontSize: 12 },
  panel: { backgroundColor: '#14181d', borderRadius: 8, gap: 4, padding: 12 },
  panelTitle: { color: '#9aa4b2', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  mono: { color: '#cbd5e1', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  check: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 6 },
  checkBox: { color: '#7dd3fc', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  checkLabel: { color: '#e8eaed', flex: 1, fontSize: 13 },
  emit: { alignItems: 'center', backgroundColor: '#2563eb', borderRadius: 8, padding: 14 },
  emitLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  footnote: { color: '#64748b', fontSize: 11 },
  hidden: { height: 1, opacity: 0, position: 'absolute', width: 1 },
});
