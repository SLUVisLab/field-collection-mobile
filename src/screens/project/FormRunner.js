import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigate, useParams, useSearchParams } from 'react-router-native';
import { WebView } from 'react-native-webview';
import { File } from 'expo-file-system';
import { fileForKey } from 'gather-storage';

import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { XFormsProvider, useXForm } from 'odk-xforms-react';

import { Screen } from '../../components/Screen.js';
import { ActionButton, NavButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { useBackGuardRegistry } from '../../navigation/BackGuardContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { XFormsRenderer } from '../../xforms/XFormsRenderer.js';
import { outlineFor } from '../../xforms/renderModel.js';
import { bindingManifestFrom, resolveCompositionFields } from '../../xforms/compositionField.js';
import { commitCompositionResult } from '../../xforms/compositionCommit.js';
import { compositionEntryFor } from '../../a2ui/compositionRegistry.js';
import { mergeMedia } from '../../instances/mediaState.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function RunnerBody({ formId, localInstanceId = null, host, fieldworkSessionId = null, fieldworkEntityId = null }) {
  const { actions, activeProject, repositories } = useGather();
  const form = useXForm();
  const navigate = useNavigate();
  const backGuards = useBackGuardRegistry();
  const {
    loadCachedForm,
    resumeInstance,
    saveInstanceDraft,
    finalizeInstance,
    attachImageMedia,
    releaseInstanceMedia,
    discardInstance,
    sweepProjectMedia,
    associateFieldworkInstance,
  } = actions;
  const { loadForm, loadInstance } = form;
  const scrollRef = useRef(null);
  const layouts = useRef(new Map());
  const [loadingCache, setLoadingCache] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [version, setVersion] = useState(null);
  const [instance, setInstance] = useState(null);
  // The instance ROW carries no media — the lifecycle returns media alongside
  // it (`{ instance, media }`), never nested. Reading `instance.media` silently
  // yielded [] and emptied every collection field; see §22.
  const [media, setMedia] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showExitChoices, setShowExitChoices] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingCache(true);
      setLoadError(null);
      setMessage(null);
      try {
        if (localInstanceId) {
          const resumed = await resumeInstance({ localInstanceId, form: { loadInstance } });
          if (!cancelled) {
            setInstance(resumed.instance);
            setMedia(resumed.media ?? []);
            setVersion(resumed.version);
          }
        } else {
          const cached = await loadCachedForm(formId);
          await loadForm(cached.xml, cached.attachments);
          // The manifest is form-owned and travels as an attachment (§6). A
          // malformed one throws here, which surfaces as a load error rather
          // than as a composition that quietly writes nowhere.
          if (!cancelled) setManifest(bindingManifestFrom(cached.attachments));
          if (fieldworkEntityId) {
            const snapshot = await form.refreshSnapshot('fieldwork-preselect');
            const matchingReference = Object.entries(snapshot?.nodesByReference ?? {}).find(
              ([, node]) => (node.choices ?? []).some((choice) => String(choice.value) === fieldworkEntityId)
            )?.[0];
            if (!matchingReference) throw new Error('This form has no selectable fieldwork Entity binding.');
            await form.setValue(matchingReference, fieldworkEntityId);
          }
          if (!cancelled) setVersion(cached.version);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            localInstanceId
              ? 'This saved draft cannot be resumed. Its exact cached form version is unavailable.'
              : 'This form is not available offline. Refresh Forms before filling it out.'
          );
        }
      } finally {
        if (!cancelled) setLoadingCache(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    activeProject?.projectKey,
    formId,
    localInstanceId,
    fieldworkEntityId,
    loadCachedForm,
    loadForm,
    loadInstance,
    resumeInstance,
  ]);

  const saveDraft = useCallback(async () => {
    if (!version || busy) return false;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveInstanceDraft({
        localInstanceId: instance?.localInstanceId ?? null,
        form: { serialize: form.serialize, getEntityEffects: () => host.getEntityEffects() },
        version,
      });
      setInstance(saved);
      if (fieldworkSessionId && fieldworkEntityId) {
        await associateFieldworkInstance({
          sessionId: fieldworkSessionId,
          entityId: fieldworkEntityId,
          localInstanceId: saved.localInstanceId,
        });
      }
      setMessage('Draft saved on this device.');
      // A safe lifecycle boundary: the draft's XML is durable, so the
      // referenced set is settled and a sweep can tell what is still needed.
      // Cleanup must never fail a save, so this is best-effort and its outcome
      // is not surfaced. The composition-commit boundary is the other place
      // this belongs, and the composition adapter reaches it.
      // docs/b-custom-composition-conventions.md §4.
      void Promise.resolve(sweepProjectMedia?.()).catch(() => {});
      // The saved instance, not a boolean: the composition adapter needs its
      // id to attach provenance, and an object is still truthy for callers
      // that only check success.
      return saved;
    } catch (error) {
      setMessage(error?.message ?? 'Could not save this draft.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [associateFieldworkInstance, busy, fieldworkEntityId, fieldworkSessionId, form.serialize, instance?.localInstanceId, saveInstanceDraft, sweepProjectMedia, version]);

  // Collection field adapter (storage half). The control owns the repeat APIs;
  // this owns persistence and orphan cleanup. See
  // docs/b-standard-field-conventions.md §4.
  const captureIntoCollection = useCallback(
    async (reference, capture) => {
      if (!version || typeof capture?.uri !== 'string') return false;
      setBusy(true);
      setMessage(null);
      try {
        const sourceFile = new File(capture.uri);
        if (!sourceFile.exists) throw new Error('The captured image is unavailable.');
        const bound = await attachImageMedia({
          localInstanceId: instance?.localInstanceId ?? null,
          form: { setValue: form.setValue, serialize: form.serialize },
          version,
          reference,
          sourceFile,
          contentType: capture.contentType,
        });
        setInstance(bound.instance);
        setMedia((prev) => mergeMedia(prev, bound.media));
        return true;
      } finally {
        setBusy(false);
      }
    },
    [attachImageMedia, form.serialize, form.setValue, instance?.localInstanceId, version]
  );

  const removeFromCollection = useCallback(
    async (filenames) => {
      if (!version || !instance?.localInstanceId || !Array.isArray(filenames) || filenames.length === 0) return false;
      setBusy(true);
      setMessage(null);
      try {
        const saved = await releaseInstanceMedia({
          localInstanceId: instance.localInstanceId,
          form: { serialize: form.serialize },
          version,
          filenames,
        });
        setInstance(saved.instance);
        const released = new Set(saved.released ?? filenames);
        setMedia((prev) => prev.filter((row) => !released.has(row.filename)));
        return true;
      } finally {
        setBusy(false);
      }
    },
    [form.serialize, instance?.localInstanceId, releaseInstanceMedia, version]
  );

  // Composition field adapter. Resolution is the manifest's, commit and
  // provenance are compositionCommit's; this only supplies them and the
  // lifecycle boundary. See docs/b-custom-composition-conventions.md.
  const resolvedCompositions = useMemo(
    () => resolveCompositionFields({ renderModel: form.renderModel, manifest }),
    [form.renderModel, manifest]
  );

  const commitComposition = useCallback(
    async ({ field, result, receipt }) => {
      // Provenance attaches to an instance, so a draft has to exist before the
      // commit — otherwise the very first composition run in a fresh form
      // would be refused for want of somewhere to record it. Creating the
      // draft first is better than skipping provenance, which would silently
      // break principle 5.
      let localInstanceId = instance?.localInstanceId ?? null;
      if (!localInstanceId) {
        const created = await saveDraft();
        localInstanceId = created?.localInstanceId ?? null;
        if (!localInstanceId) {
          throw new Error('This result could not be saved: the draft could not be created.');
        }
      }
      const outcome = await commitCompositionResult({
        result,
        field,
        form: { setValue: form.setValue },
        receipts: repositories?.instances ?? null,
        receipt,
        localInstanceId,
      });
      // Then persist the values the composition just wrote. saveDraft sweeps at
      // its own boundary, which is the post-commit boundary too. It can decline
      // (another operation holds `busy`), and the values would then live only
      // in engine state until the next save — so report it rather than letting
      // "Recorded 3 values" stand for something not yet on disk.
      const persisted = Boolean(await saveDraft());
      return { ...outcome, persisted };
    },
    [form.setValue, instance?.localInstanceId, repositories?.instances, saveDraft]
  );

  const compositionAdapter = useMemo(
    () => ({
      fieldFor: (reference) =>
        resolvedCompositions.fields.find((field) => field.reference === reference) ?? null,
      entryFor: (compositionId) => compositionEntryFor(compositionId),
      onAccepted: commitComposition,
      problems: resolvedCompositions.problems,
    }),
    [commitComposition, resolvedCompositions]
  );

  const collectionAdapter = useMemo(
    () => ({
      media,
      uriFor: (fileKey) => fileForKey(fileKey)?.uri ?? null,
      onCapture: captureIntoCollection,
      onRemove: removeFromCollection,
    }),
    [captureIntoCollection, media, removeFromCollection]
  );

  const attachCapturedImage = useCallback(
    async (node, capture, previousFilename = null) => {
      if (!version || busy || !node?.reference || typeof capture?.uri !== 'string') return false;
      setBusy(true);
      setMessage(null);
      try {
        const sourceFile = new File(capture.uri);
        if (!sourceFile.exists) throw new Error('The captured image is unavailable.');
        const bound = await attachImageMedia({
          localInstanceId: instance?.localInstanceId ?? null,
          form: { setValue: form.setValue, serialize: form.serialize },
          version,
          reference: node.reference,
          sourceFile,
          contentType: capture.contentType,
          // The node's current value identifies the attachment being replaced;
          // its reference does not (positional inside a repeat).
          previousFilename,
        });
        setInstance(bound.instance);
        setMedia((prev) => mergeMedia(prev, bound.media, previousFilename));
        setMessage('Captured image attached and saved in this draft.');
        return true;
      } catch (error) {
        setMessage(error?.message ?? 'Could not attach the captured image.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [attachImageMedia, busy, form.serialize, form.setValue, instance?.localInstanceId, version]
  );

  const finalize = async (advance = false) => {
    if (!version || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const ready = await finalizeInstance({
        localInstanceId: instance?.localInstanceId ?? null,
        form: { serialize: form.serialize, getEntityEffects: form.getEntityEffects },
        version,
      });
      setInstance(ready);
      if (fieldworkSessionId && fieldworkEntityId) {
        await associateFieldworkInstance({
          sessionId: fieldworkSessionId,
          entityId: fieldworkEntityId,
          localInstanceId: ready.localInstanceId,
        });
        navigate(`/project/fieldwork/${encodeURIComponent(fieldworkSessionId)}${advance ? '?next=1' : ''}`, { replace: true });
      } else {
        navigate(`/project/drafts/${encodeURIComponent(ready.localInstanceId)}`, { replace: true });
      }
    } catch (error) {
      setMessage(error?.message ?? 'Could not mark this form ready.');
    } finally {
      setBusy(false);
    }
  };

  const finalizeAndNext = async () => {
    await finalize(true);
  };

  const requestExit = useCallback(() => {
    if (!busy) setShowExitChoices(true);
  }, [busy]);

  useEffect(() => backGuards?.register(requestExit), [backGuards, requestExit]);

  const exitAfterSave = async () => {
    const saved = await saveDraft();
    if (saved) {
      setShowExitChoices(false);
      // `replace`, not push: otherwise the form stays on the stack and Back
      // from Forms drops straight back into it instead of going up.
      navigate('/project/forms', { replace: true });
    }
  };

  const discardAndExit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (instance?.localInstanceId) await discardInstance(instance.localInstanceId);
      setShowExitChoices(false);
      navigate('/project/forms', { replace: true });
    } catch (error) {
      setMessage(error?.message ?? 'Could not discard this draft.');
    } finally {
      setBusy(false);
    }
  };

  const outline = outlineFor(form.renderModel, form.snapshot);
  const scrollTo = (reference) => {
    const y = layouts.current.get(reference);
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  return (
    <Screen
      screenId="project-form"
      title={version?.displayName ?? 'Fill out form'}
      subtitle={version?.sourceVersion ? `Version ${version.sourceVersion}` : formId}
      canGoBack
      onBack={requestExit}
      scrollRef={scrollRef}
    >
      {loadingCache || form.loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {loadError ? (
        <>
          <Text style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
            {loadError}
          </Text>
          <NavButton to="/project/forms" label="Back to Forms" testID="back-to-forms" />
        </>
      ) : null}
      {form.error ? (
        <Text style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
          Form engine error: {form.error.message}
        </Text>
      ) : null}
      {message ? (
        <Text style={[styles.message, { color: theme.colors.success, lineHeight: tokens.typography.bodyLineHeight }]}>
          {message}
        </Text>
      ) : null}
      {instance ? (
        <Text style={[styles.instanceStatus, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>
          {instance.state === 'draft' ? 'Saving draft' : instance.state}
        </Text>
      ) : null}
      {form.ready && outline.length > 0 ? (
        <View style={[styles.outline, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md, gap: tokens.spacing.xs, padding: tokens.spacing.md }]}>
          <Text style={[styles.outlineTitle, { color: theme.colors.text }]}>Form outline</Text>
          {outline.map((entry) => (
            <Pressable
              key={entry.reference}
              accessibilityLabel={`Jump to ${entry.label}`}
              accessibilityRole="button"
              onPress={() => scrollTo(entry.reference)}
              style={({ pressed }) => [
                styles.outlineItem,
                {
                  borderRadius: tokens.radii.sm,
                  marginLeft: Math.min(entry.depth, 3) * tokens.spacing.sm,
                  minHeight: tokens.interaction.minimumTouchTarget,
                },
                pressed && styles.outlineItemPressed,
                pressed && { backgroundColor: theme.colors.surfaceMuted },
              ]}
              testID={`outline-${entry.reference}`}
            >
              <Text style={[styles.outlineText, { color: theme.colors.primary, fontSize: tokens.typography.helper }]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {form.ready ? (
        <XFormsRenderer
          collection={collectionAdapter}
          composition={compositionAdapter}
          onAttachImage={attachCapturedImage}
          attachBusy={busy}
          onNodeLayout={(reference, event) => layouts.current.set(reference, event.nativeEvent.layout.y)}
        />
      ) : null}
      {form.ready && version ? (
        <View style={[styles.lifecycleActions, { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }]}>
          <ActionButton
            onPress={() => void saveDraft()}
            label={busy ? 'Saving…' : 'Save draft'}
            disabled={busy}
            testID="save-draft"
          />
          {fieldworkSessionId ? (
            <ActionButton
              onPress={finalizeAndNext}
              label={busy ? 'Checking…' : 'Finalize & Next'}
              disabled={busy}
              testID="finalize-next-instance"
            />
          ) : null}
          <ActionButton
            onPress={finalize}
            label={busy ? 'Checking…' : 'Mark ready to send'}
            disabled={busy}
            testID="finalize-instance"
          />
          <ActionButton
            onPress={requestExit}
            label="Exit form"
            tone="danger"
            disabled={busy}
            testID="exit-form"
          />
        </View>
      ) : null}
      <Modal visible={showExitChoices} transparent animationType="fade" onRequestClose={() => setShowExitChoices(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay, padding: tokens.spacing.xxl }]}>
          <View style={[styles.modal, { backgroundColor: theme.colors.background, borderRadius: tokens.radii.lg, gap: tokens.spacing.md, padding: tokens.spacing.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: tokens.typography.heading }]}>
              Leave this form?
            </Text>
            <Text style={[styles.modalText, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
              Choose whether to save the current XML draft or discard it.
            </Text>
            <ActionButton
              onPress={() => void exitAfterSave()}
              label={busy ? 'Saving…' : 'Save draft and exit'}
              disabled={busy || !version}
              testID="save-draft-and-exit"
            />
            <ActionButton
              onPress={() => setShowExitChoices(false)}
              label="Continue filling"
              disabled={busy}
              testID="continue-filling"
            />
            <ActionButton
              onPress={() => void discardAndExit()}
              label="Discard form"
              tone="danger"
              disabled={busy}
              testID="discard-form"
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/**
 * Native UI is intentionally a thin projection over `FormRenderModel` plus the
 * engine snapshot. The hidden WebView is the only engine owner; React stores no
 * separate question schema or answer model.
 */
export function FormRunner() {
  const { formId = '', instanceId = null } = useParams();
  const [search] = useSearchParams();
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 45_000 }), []);
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () => createSidecarWebViewProps({ html, onMessage: (event) => host.handleWebViewMessage(event) }),
    [html, host]
  );

  return (
    <XFormsProvider host={host}>
      <RunnerBody
        formId={formId}
        localInstanceId={instanceId}
        host={host}
        fieldworkSessionId={search.get('fieldworkSession')}
        fieldworkEntityId={search.get('entityId')}
      />
      {/*
        The engine sidecar. `react-native-webview`'s own container style is
        `flex: 1`, so rendered bare it becomes a sibling competing with the
        flex:1 `Screen` and the form gets only a fraction of the height. It has
        to run (it hosts the XForms engine) but must never take part in layout:
        absolutely positioned, 1x1, transparent and untouchable.
      */}
      <View style={styles.engineHost} pointerEvents="none">
        <WebView ref={webViewRef} {...webViewProps} />
      </View>
    </XFormsProvider>
  );
}

const styles = StyleSheet.create({
  engineHost: { height: 1, opacity: 0, position: 'absolute', top: 0, left: 0, width: 1 },
  outline: {},
  outlineTitle: { fontWeight: '700' },
  outlineItem: { justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 5 },
  outlineItemPressed: { opacity: 0.82 },
  outlineText: {},
  error: {},
  message: {},
  instanceStatus: { fontWeight: '600' },
  lifecycleActions: {},
  modalBackdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  modal: { maxWidth: 420, width: '100%' },
  modalTitle: { fontWeight: '700' },
  modalText: {},
});
