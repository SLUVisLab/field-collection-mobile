import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
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

/**
 * Media identity gate — the on-device counterpart to
 * docs/repeat-media-identity-characterization.md.
 *
 * Attachment identity must be minted at capture and must never derive from the
 * XForms binding reference, because repeat references reindex on deletion and a
 * survivor would otherwise inherit the deleted item's row and file. This
 * exercises those invariants against **real SQLite, real files and the real
 * engine**, which the unit tests cannot.
 *
 * The Central transport is stubbed (the multipart parts are captured), so the
 * gate needs no server and creates no remote artifacts. The live submission
 * path is unchanged and remains covered by the existing M5.5 runner.
 *
 * Two projects are used because `instances` is UNIQUE on
 * `(project_key, odk_instance_id)` and the engine's preloaded `instanceID` is
 * not distinct across fresh `loadForm` calls — so a second draft needs its own
 * project rather than a second preload.
 */
const GATE_PROJECT_KEY = 'media-identity-gate';
const SUBMIT_PROJECT_KEY = 'media-identity-gate-submit';
const PHOTO = '/data/photo';

const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Media identity gate</h:title><model>
    <instance><data id="media_identity_gate"><note/><photo/><meta><instanceID/></meta></data></instance>
    <bind nodeset="/data/note" type="string"/>
    <bind nodeset="/data/photo" type="binary"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/note"><label>Note</label></input>
    <upload ref="/data/photo" mediatype="image/*"><label>Photo</label></upload>
  </h:body>
</h:html>`;

export default function MediaIdentityGateApp() {
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
      console.log(`MEDIA_IDENTITY_RESULT::${JSON.stringify(summary)}`);
    };
    const watchdog = setTimeout(() => finish({ error: 'gate timed out', checks: {} }), 150_000);
    let cancelled = false;

    const run = async () => {
      let database = null;
      try {
        const storage = await initializeGatherStorage();
        database = storage.database;
        const forms = createFormsRepository(database);
        const instances = createInstancesRepository(database);
        const projects = createProjectsRepository(database);

        const seedProject = async (projectKey, displayName, centralProjectId) => {
          if (await projects.getProject(projectKey)) {
            await projects.deleteProject(projectKey);
            deleteProjectDirectory(projectKey);
          }
          await projects.upsertProject({ projectKey, displayName, baseUrl: 'https://gate.invalid', centralProjectId });
          ensureProjectDirectories(projectKey);
          const xmlFileKey = `projects/${projectKey}/forms/media-identity/form.xml`;
          const version = await forms.recordCachedVersion({
            projectKey,
            formId: 'media_identity_gate',
            displayName: 'Media identity gate',
            sourceVersion: '1',
            sourceHash: 'md5:mediaidentity',
            manifestFingerprint: manifestFingerprintFor([]),
            xmlFileKey,
            manifestFileKey: `projects/${projectKey}/forms/media-identity/manifest.json`,
            resources: [],
          });
          await writeTextAtomic(xmlFileKey, FORM_XML);
          return { project: { projectKey, baseUrl: 'https://gate.invalid', centralProjectId }, version };
        };

        let submitInput = null;
        let instanceSeq = 0;
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
              const parts = buildSubmissionParts(input);
              submitInput = { ...input, parts, body: toFormData(parts) };
              return { status: 201, message: 'gate accepted' };
            },
          }),
          newLocalInstanceId: () => `media-identity-${(instanceSeq += 1)}`,
        });

        const source = await loadBundledFlowerImageFixture();
        const formBridge = {
          setValue: (reference, value) => host.setValue(reference, value),
          serialize: () => host.serialize(),
        };
        const attach = async ({ project, version, localInstanceId = null, previousFilename = null, note }) => {
          await host.loadForm(FORM_XML);
          await host.setValue('/data/note', note);
          return lifecycle.attachImageMedia({
            project,
            form: formBridge,
            version,
            localInstanceId,
            reference: PHOTO,
            sourceFile: source.file,
            contentType: source.contentType,
            previousFilename,
          });
        };

        // --- Identity invariants, all within one draft -------------------------
        const gate = await seedProject(GATE_PROJECT_KEY, 'Media identity gate', 1);
        const first = await attach({ ...gate, note: 'first' });
        // A second capture at the SAME reference: previously this collided on the
        // primary key and clobbered the first row. It must now stand alone.
        const second = await attach({ ...gate, localInstanceId: first.instance.localInstanceId, note: 'second' });
        const rowsAfterReuse = await instances.listMedia(first.instance.localInstanceId);
        // Sampled here: the reuse invariant is about this intermediate state,
        // before the replacement below legitimately retires `second`.
        const bytesAfterReuse = {
          first: fileForKey(first.media.fileKey).exists,
          second: fileForKey(second.media.fileKey).exists,
        };
        // Retiring by node value must remove *exactly* the named attachment; the
        // earlier one at the same reference has to survive.
        const third = await attach({
          ...gate,
          localInstanceId: first.instance.localInstanceId,
          previousFilename: second.media.filename,
          note: 'third',
        });
        const rowsAfterReplace = await instances.listMedia(first.instance.localInstanceId);
        const replacedXml = await readText(third.instance.xmlFileKey);

        // --- Submission carries the filename the XML references ---------------
        const submitGate = await seedProject(SUBMIT_PROJECT_KEY, 'Media identity gate (submit)', 2);
        const submitted = await attach({ ...submitGate, note: 'submit' });
        const ready = await lifecycle.finalize({
          localInstanceId: submitted.instance.localInstanceId,
          project: submitGate.project,
          form: { serialize: () => host.serialize() },
          version: submitGate.version,
        });
        const sent = await lifecycle.send({ localInstanceId: ready.localInstanceId, project: submitGate.project });
        const submittedNames = (submitInput?.attachments ?? []).map((entry) => entry.name);

        // Sample byte existence BEFORE any teardown: `deleteProjectDirectory`
        // removes the whole media tree, so a lazily-evaluated `.exists` inside
        // the checks below would report every file gone.
        const bytesAfterReplace = {
          first: fileForKey(first.media.fileKey).exists,
          second: fileForKey(second.media.fileKey).exists,
          third: fileForKey(third.media.fileKey).exists,
        };

        await projects.deleteProject(SUBMIT_PROJECT_KEY);
        deleteProjectDirectory(SUBMIT_PROJECT_KEY);
        const submitMediaGone = !fileForKey(submitted.media.fileKey).exists;
        await projects.deleteProject(GATE_PROJECT_KEY);
        deleteProjectDirectory(GATE_PROJECT_KEY);

        const checks = {
          // Migration 10 re-keyed instance_media off the binding reference.
          migrationApplied: storage.schemaVersion >= 10,
          // Same reference, same bytes: identity is minted, never derived.
          filenameMintedNotDerived:
            first.media.filename !== second.media.filename &&
            second.media.filename !== third.media.filename &&
            first.media.filename !== third.media.filename &&
            /^image-[a-z0-9]+\.jpg$/.test(first.media.filename),
          // The regression: a capture at a reused reference inherits nothing.
          reusedReferenceKeepsBothRows: rowsAfterReuse.length === 2,
          reusedReferenceKeepsBothFiles: bytesAfterReuse.first && bytesAfterReuse.second,
          // Retirement is precise.
          replaceRetiresOnlyNamedRow:
            rowsAfterReplace.length === 2 &&
            rowsAfterReplace.some((row) => row.filename === first.media.filename) &&
            rowsAfterReplace.some((row) => row.filename === third.media.filename) &&
            !rowsAfterReplace.some((row) => row.filename === second.media.filename),
          replaceDeletesOnlyNamedBytes:
            !bytesAfterReplace.second && bytesAfterReplace.first && bytesAfterReplace.third,
          replacedXmlBindsNewFilename: replacedXml.includes(`<photo>${third.media.filename}</photo>`),
          submissionCarriesCurrentFilename:
            sent.ok === true && submittedNames.length === 1 && submittedNames[0] === submitted.media.filename,
          projectRemovalCleansMedia:
            (await projects.getProject(SUBMIT_PROJECT_KEY)) == null && submitMediaGone,
        };
        if (!cancelled) {
          finish({
            checks,
            schemaVersion: storage.schemaVersion,
            filenames: {
              first: first.media.filename,
              second: second.media.filename,
              third: third.media.filename,
              submitted: submitted.media.filename,
            },
          });
        }
      } catch (error) {
        if (!cancelled) finish({ error: error?.message ?? String(error), checks: {} });
      } finally {
        try {
          if (database) await closeGatherStorage();
        } catch {
          // Preserve the original failure.
        }
        clearTimeout(watchdog);
      }
    };

    const timer = setTimeout(() => void run(), 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
    };
  }, [host]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Media identity gate</Text>
        <Text style={styles.mono}>{result ? JSON.stringify(result, null, 2) : 'running…'}</Text>
      </ScrollView>
      <View style={styles.hidden} pointerEvents="none">
        <WebView ref={webViewRef} {...webViewProps} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  body: { padding: 16, gap: 12 },
  title: { color: '#e8eaed', fontSize: 18, fontWeight: '700' },
  mono: { color: '#9aa4b2', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  hidden: { height: 1, opacity: 0, width: 1 },
});
