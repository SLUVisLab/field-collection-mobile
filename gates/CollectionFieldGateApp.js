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
import { controlKindFor } from '../src/xforms/renderModel.js';
import {
  binaryChildrenOf,
  collectionItemsFrom,
  multiImageConfigFrom,
  newestBinaryChild,
  orphanedFilenames,
} from '../src/xforms/collectionField.js';

/**
 * Collection field gate — the multi-image collection path end to end on device.
 *
 * Drives the exact sequence `XFormsMultiImageControl` performs, but against the
 * **real engine, real SQLite and real files**: appearance recognition, capture
 * into repeat instances, removal with orphan cleanup, a storage restart with
 * draft resume mid-collection, and a multi-attachment submission.
 *
 * The form is the **pyxform-canonical** shape — appearance on the `<repeat>`,
 * wrapping `<group>` left bare — which is what `begin_repeat … appearance=…`
 * actually compiles to (docs/b-standard-field-conventions.md §1). It also
 * carries an ordinary appearance-free repeat, so recognition is proven
 * *additive* rather than a change to how every repeat renders.
 *
 * The image child is deliberately named `frame`, not `photo`: the child's name
 * belongs to the form author, so a fixture that happened to match a hardcoded
 * default could pass while every other form silently projected nothing. That
 * is precisely the defect this fixture now constrains.
 *
 * It does **not** render React, so it verifies the pipeline rather than the
 * control's presentation; the interactive camera still needs a physical device.
 * The Central transport is stubbed, so no server is touched.
 */
const GATE_PROJECT_KEY = 'collection-field-gate';
const PHOTOS = '/data/photos';
const PLAIN = '/data/remarks';

const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Collection field gate</h:title><model>
    <instance><data id="collection_field_gate">
      <note/>
      <photos jr:template=""><frame/></photos>
      <remarks jr:template=""><remark/></remarks>
      <meta><instanceID/></meta>
    </data></instance>
    <bind nodeset="/data/note" type="string"/>
    <bind nodeset="/data/photos/frame" type="binary"/>
    <bind nodeset="/data/remarks/remark" type="string"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/note"><label>Note</label></input>
    <group ref="/data/photos">
      <label>Photos</label>
      <repeat nodeset="/data/photos" appearance="gather-multi-image min=2 max=3">
        <upload ref="/data/photos/frame" mediatype="image/*"><label>Photo</label></upload>
      </repeat>
    </group>
    <group ref="/data/remarks">
      <label>Remarks</label>
      <repeat nodeset="/data/remarks">
        <input ref="/data/remarks/remark"><label>Remark</label></input>
      </repeat>
    </group>
  </h:body>
</h:html>`;

const isRepeatRange = (node) =>
  typeof node?.nodeType === 'string' && node.nodeType.startsWith('repeat-range:');

export default function CollectionFieldGateApp() {
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
      console.log(`COLLECTION_FIELD_RESULT::${JSON.stringify(summary)}`);
    };
    const watchdog = setTimeout(() => finish({ error: 'gate timed out', checks: {} }), 180_000);
    let cancelled = false;

    const run = async () => {
      let database = null;
      let stage = 'init';
      try {
        let storage = await initializeGatherStorage();
        database = storage.database;
        let forms = createFormsRepository(database);
        let instances = createInstancesRepository(database);
        let projects = createProjectsRepository(database);

        stage = 'seed-project';
        if (await projects.getProject(GATE_PROJECT_KEY)) {
          await projects.deleteProject(GATE_PROJECT_KEY);
          deleteProjectDirectory(GATE_PROJECT_KEY);
        }
        await projects.upsertProject({
          projectKey: GATE_PROJECT_KEY,
          displayName: 'Collection field gate',
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(GATE_PROJECT_KEY);
        const xmlFileKey = `projects/${GATE_PROJECT_KEY}/forms/collection/form.xml`;
        const version = await forms.recordCachedVersion({
          projectKey: GATE_PROJECT_KEY,
          formId: 'collection_field_gate',
          displayName: 'Collection field gate',
          sourceVersion: '1',
          sourceHash: 'md5:collectionfield',
          manifestFingerprint: manifestFingerprintFor([]),
          xmlFileKey,
          manifestFileKey: `projects/${GATE_PROJECT_KEY}/forms/collection/manifest.json`,
          resources: [],
        });
        await writeTextAtomic(xmlFileKey, FORM_XML);

        const project = {
          projectKey: GATE_PROJECT_KEY,
          baseUrl: 'https://gate.invalid',
          centralProjectId: 1,
        };
        let submitInput = null;
        const lifecycleFor = (repositories) =>
          createInstanceLifecycleService({
            instances: repositories.instances,
            formCatalog: {
              async loadFormVersion(formVersionId) {
                const found = await repositories.forms.getVersion(formVersionId);
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
          });
        let lifecycle = lifecycleFor({ instances, forms });
        const formBridge = {
          setValue: (reference, value) => host.setValue(reference, value),
          serialize: () => host.serialize(),
          loadInstance: (xml, instanceXml, attachments) =>
            host.loadInstance(xml, instanceXml, attachments),
        };

        // --- appearance recognition, through the real render model -----------
        stage = 'recognition';
        await host.loadForm(FORM_XML);
        await host.setValue('/data/note', 'collection gate');
        const renderModel = await host.getRenderModel();
        // The wrapping <group> shares the repeat's reference, so select by node
        // type; the engine collapses the pair onto a single repeat-range node.
        const photosNode = renderModel.nodes.find(
          (node) => isRepeatRange(node) && node.reference === PHOTOS
        );
        const plainNode = renderModel.nodes.find(
          (node) => isRepeatRange(node) && node.reference === PLAIN
        );
        const config = multiImageConfigFrom(photosNode?.appearances);
        const nodesAtPhotosReference = renderModel.nodes
          .filter((node) => node.reference === PHOTOS)
          .map((node) => node.nodeType);

        // --- capture three photos into repeat instances ----------------------
        // Exactly what the control does: add the instance, then resolve its
        // binary child from a fresh snapshot — the child's name belongs to the
        // form author, so it is read, never assumed.
        stage = 'capture';
        const source = await loadBundledFlowerImageFixture();
        let localInstanceId = null;
        const captureOne = async (label) => {
          const added = await host.addRepeat(PHOTOS);
          const reference = newestBinaryChild(
            binaryChildrenOf({
              repeatReference: PHOTOS,
              nodesByReference: added?.snapshot?.nodesByReference,
            })
          );
          if (!reference) throw new Error(`no photo slot resolved for ${label}`);
          const attached = await lifecycle.attachImageMedia({
            project,
            form: formBridge,
            version,
            localInstanceId,
            reference,
            sourceFile: source.file,
            contentType: source.contentType,
          });
          localInstanceId = attached.instance.localInstanceId;
          return { ...attached, reference };
        };
        const first = await captureOne('first');
        const second = await captureOne('second');
        const third = await captureOne('third');

        const instancePattern = new RegExp(`^${PHOTOS}\\[\\d+\\]$`);
        const itemsFor = async () => {
          const snapshot = await host.getSnapshot();
          const references = Object.keys(snapshot?.nodesByReference ?? {}).filter((key) =>
            instancePattern.test(key)
          );
          const binaryChildren = binaryChildrenOf({
            repeatReference: PHOTOS,
            nodesByReference: snapshot?.nodesByReference,
          });
          return collectionItemsFrom({
            instanceReferences: references,
            binaryChildOf: (instanceReference) => binaryChildren.get(instanceReference) ?? null,
            valueAt: (reference) => snapshot?.nodesByReference?.[reference]?.instanceValue ?? '',
            media: await instances.listMedia(localInstanceId),
            uriFor: (fileKey) => fileForKey(fileKey)?.uri ?? null,
          });
        };
        const afterCapture = await itemsFor();
        const capturedXml = await readText(first.instance.xmlFileKey);

        // --- remove the middle one, with orphan cleanup ----------------------
        stage = 'remove';
        const target = afterCapture.find((item) => item.filename === second.media.filename);
        if (!target) throw new Error('the second capture is not in the projected collection');
        await host.removeRepeat(PHOTOS, target.position - 1);
        const remaining = await itemsFor();
        const orphans = orphanedFilenames({ before: afterCapture, after: remaining });
        const released = await lifecycle.releaseInstanceMedia({
          project,
          localInstanceId,
          form: formBridge,
          version,
          filenames: orphans,
        });
        const rowsAfterRemoval = await instances.listMedia(localInstanceId);
        const bytesAfterRemoval = {
          first: fileForKey(first.media.fileKey).exists,
          second: fileForKey(second.media.fileKey).exists,
          third: fileForKey(third.media.fileKey).exists,
        };
        const releasedXml = await readText(first.instance.xmlFileKey);

        // --- storage restart + draft resume mid-collection -------------------
        // The requirement that made MultiImageCapture a controlled Component:
        // the collection has to come back from the instance XML, not from any
        // in-memory state the control happened to be holding.
        stage = 'resume';
        await host.loadForm(FORM_XML);
        const emptyOnReload = await itemsFor();
        await closeGatherStorage();
        storage = await initializeGatherStorage();
        database = storage.database;
        forms = createFormsRepository(database);
        instances = createInstancesRepository(database);
        projects = createProjectsRepository(database);
        lifecycle = lifecycleFor({ instances, forms });
        const resumed = await lifecycle.resume({ localInstanceId, project, form: formBridge });
        const resumedItems = await itemsFor();

        // --- finalize + submit both remaining attachments --------------------
        stage = 'submit';
        const ready = await lifecycle.finalize({
          localInstanceId,
          project,
          form: formBridge,
          version: resumed.version,
        });
        const sent = await lifecycle.send({ localInstanceId: ready.localInstanceId, project });
        const submittedNames = (submitInput?.attachments ?? []).map((entry) => entry.name).sort();
        const submittedXml = await readText(ready.xmlFileKey ?? first.instance.xmlFileKey);

        // Sample byte existence BEFORE teardown: `deleteProjectDirectory`
        // removes the media tree, and a lazily-evaluated `.exists` in the
        // checks below would then report every file gone.
        stage = 'teardown';
        await projects.deleteProject(GATE_PROJECT_KEY);
        deleteProjectDirectory(GATE_PROJECT_KEY);

        const survivors = [first.media.filename, third.media.filename].sort();
        const checks = {
          migrationApplied: storage.schemaVersion >= 10,

          // Recognition — the appearance, on the <repeat> as pyxform emits it,
          // is what turns an ordinary repeat into a collection field.
          appearanceRecognized: controlKindFor(photosNode) === 'multi-image',
          recognitionIsAdditive: controlKindFor(plainNode) === 'repeat',
          groupCollapsesOntoOneRepeatRange: nodesAtPhotosReference.length === 1,
          cardinalityFromAppearance:
            config.enabled && config.minItems === 2 && config.maxItems === 3,

          // Capture — three captures, three instances, three distinct identities.
          capturedThreeDistinct:
            new Set([first.media.filename, second.media.filename, third.media.filename]).size === 3 &&
            /^image-[a-z0-9]+\.jpg$/.test(first.media.filename),
          capturedIntoDistinctInstances:
            new Set([first.reference, second.reference, third.reference]).size === 3,
          repeatProjectsToThreeItems: afterCapture.length === 3,
          itemsOrderedByPosition:
            afterCapture.map((item) => item.position).join(',') === '1,2,3' &&
            afterCapture[0].filename === first.media.filename &&
            afterCapture[2].filename === third.media.filename,
          itemsCarryRenderableUri: afterCapture.every(
            (item) => typeof item.uri === 'string' && item.uri.length > 0
          ),
          // One filename per repeat instance in the authoritative XML — no
          // array serialized into a hidden node (b-standard §4). The element is
          // `frame`, so a hardcoded `photo` cannot satisfy this.
          xmlBindsOneFilenamePerInstance:
            [first, second, third].every((entry) =>
              capturedXml.includes(`<frame>${entry.media.filename}</frame>`)
            ) && (capturedXml.match(/<frame>/g) ?? []).length === 3,
          // The child's name came from the engine, not from a default.
          resolvedAuthoredChildName:
            first.reference.endsWith('/frame') &&
            new Set([first, second, third].map((entry) => entry.reference.split('/').pop())).size === 1,

          // Removal — identity is the filename, never the position.
          orphanIdentifiedByFilename: orphans.length === 1 && orphans[0] === second.media.filename,
          releasedOnlyTheOrphan:
            released.released.length === 1 && released.released[0] === second.media.filename,
          removalLeavesTwoRows:
            rowsAfterRemoval.length === 2 &&
            rowsAfterRemoval.map((row) => row.filename).sort().join(',') === survivors.join(','),
          removalKeepsSurvivorBytes:
            bytesAfterRemoval.first && bytesAfterRemoval.third && !bytesAfterRemoval.second,
          survivorsReindexedNotReidentified:
            remaining.length === 2 &&
            remaining.map((item) => item.position).join(',') === '1,2' &&
            remaining.map((item) => item.filename).sort().join(',') === survivors.join(','),
          releasedXmlDropsOnlyTheOrphan:
            !releasedXml.includes(second.media.filename) &&
            releasedXml.includes(first.media.filename) &&
            releasedXml.includes(third.media.filename),

          // Resume — the collection is reconstructed from the instance XML.
          reloadStartsEmpty: emptyOnReload.length === 0,
          resumeRestoresCollection:
            resumedItems.length === 2 &&
            resumedItems.map((item) => item.position).join(',') === '1,2' &&
            resumedItems.map((item) => item.filename).sort().join(',') === survivors.join(','),
          resumeKeepsExactFormVersion: resumed.version.formVersionId === version.formVersionId,
          resumeReportsBothMediaRows: (resumed.media ?? []).length === 2,

          // Submission — one attachment per surviving item.
          submitsBothAttachments:
            sent.ok === true &&
            submittedNames.length === 2 &&
            submittedNames.join(',') === survivors.join(','),
          submittedXmlMatchesAttachments:
            submittedXml.includes(first.media.filename) &&
            submittedXml.includes(third.media.filename) &&
            !submittedXml.includes(second.media.filename),
        };
        if (!cancelled) {
          finish({
            checks,
            schemaVersion: storage.schemaVersion,
            config,
            photosNodeType: photosNode?.nodeType ?? null,
            appearances: photosNode?.appearances ?? null,
            nodesAtPhotosReference,
            filenames: {
              first: first.media.filename,
              second: second.media.filename,
              third: third.media.filename,
            },
          });
        }
      } catch (error) {
        if (!cancelled) finish({ error: `${stage}: ${error?.message ?? String(error)}`, checks: {} });
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
        <Text style={styles.title}>Collection field gate</Text>
        <Text style={styles.subtitle}>appearance → capture → orphan cleanup → resume → submit</Text>
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
  subtitle: { color: '#7b8794', fontSize: 12 },
  mono: { color: '#9aa4b2', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  hidden: { height: 1, opacity: 0, width: 1 },
});
