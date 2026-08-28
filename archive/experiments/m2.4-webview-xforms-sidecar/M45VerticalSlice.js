import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { OdkCentralClient, createAppUserAuth } from './src/central/index.js';
import { WebViewXFormsHost } from './src/host/WebViewXFormsHost';
import { createWebViewSidecarHtml } from './src/host/createWebViewSidecarHtml';
import { XFormsProvider, useXForm } from './src/react';
import { LIVE_CONFIG } from './src/central/liveConfig.local.js';

const MAX_EVENTS = 80;
let scenarioRunStarted = false;

const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const PREFERRED_ASSIGNMENTS = Object.freeze([
  {
    reference: '/data/field_site',
    valueFactory: (runLabel) => `M4.5 ${runLabel}`,
  },
  { reference: '/data/block', valueFactory: () => 11 },
  { reference: '/data/column', valueFactory: () => 12 },
  { reference: '/data/row', valueFactory: () => 13 },
  { reference: '/data/flower_head_count', valueFactory: () => 3 },
  { reference: '/data/plant_height_cm', valueFactory: () => 7.25 },
]);

const isWritableNode = (node) => Boolean(node) && node.readonly !== true && node.relevant !== false;

const chooseFallbackAssignment = (snapshot, runLabel) => {
  const entries = Object.entries(snapshot?.nodesByReference ?? {});
  for (const [reference, node] of entries) {
    if (!isWritableNode(node) || reference.includes('/meta/')) {
      continue;
    }
    if (typeof node.valueType === 'string' && /^int$/i.test(node.valueType)) {
      return { reference, value: 21 };
    }
    if (typeof node.valueType === 'string' && /^decimal$/i.test(node.valueType)) {
      return { reference, value: 21.5 };
    }
    if (
      typeof node.valueType === 'string' &&
      /^select1?$/i.test(node.valueType) &&
      Array.isArray(node.choices) &&
      node.choices.length > 0
    ) {
      return { reference, value: node.choices[0].value };
    }
    if (typeof node.valueType === 'string' && /^string$/i.test(node.valueType)) {
      return { reference, value: `m4.5-${runLabel}` };
    }
  }
  return null;
};

const planAssignments = (snapshot, runLabel) => {
  const planned = [];
  for (const assignment of PREFERRED_ASSIGNMENTS) {
    const node = snapshot?.nodesByReference?.[assignment.reference] ?? null;
    if (!isWritableNode(node)) {
      continue;
    }
    planned.push({
      reference: assignment.reference,
      value: assignment.valueFactory(runLabel),
    });
  }
  if (planned.length > 0) {
    return planned;
  }
  const fallback = chooseFallbackAssignment(snapshot, runLabel);
  return fallback == null ? [] : [fallback];
};

const valueMatchesAssignment = (node, expectedValue) => {
  if (!node) {
    return false;
  }
  if (Array.isArray(node.value)) {
    return node.value.map((item) => String(item)).includes(String(expectedValue));
  }
  if (typeof expectedValue === 'number') {
    return Number(node.value) === expectedValue || Number(node.instanceValue) === expectedValue;
  }
  return String(node.instanceValue ?? node.value ?? '') === String(expectedValue);
};

const ScenarioRunner = ({ pushEvent, setSummary }) => {
  const form = useXForm();
  const latestFormRef = useRef(form);
  const latestPhaseRef = useRef(form.phase);
  const latestSnapshotRef = useRef(form.snapshot);
  latestFormRef.current = form;
  latestPhaseRef.current = form.phase;
  latestSnapshotRef.current = form.snapshot;

  useEffect(() => {
    pushEvent({
      type: 'xform-state',
      payload: {
        phase: form.phase,
        hasSnapshot: form.snapshot != null,
        nodeCount: form.snapshot?.nodeCount ?? 0,
      },
    });
  }, [form.phase, form.snapshot?.generatedAt, form.snapshot?.nodeCount, pushEvent]);

  useEffect(() => {
    if (scenarioRunStarted) {
      return;
    }
    scenarioRunStarted = true;
    let cancelled = false;

    const runStep = async (steps, name, operation) => {
      console.log(`M45_RUNTIME_STEP_START::${name}`);
      pushEvent({ type: 'step-start', payload: { name } });
      try {
        const value = await operation();
        steps.push({ name, ok: true });
        console.log(`M45_RUNTIME_STEP_OK::${name}`);
        pushEvent({ type: 'step-ok', payload: { name } });
        return value;
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        steps.push({ name, ok: false, error: resolved.message });
        console.log(`M45_RUNTIME_STEP_FAIL::${name}::${resolved.message}`);
        pushEvent({ type: 'step-fail', payload: { name, error: resolved.message } });
        throw resolved;
      }
    };

    const run = async () => {
      const steps = [];
      const startedAt = Date.now();
      const runLabel = `${Platform.OS}-${new Date().toISOString()}`;
      const client = new OdkCentralClient({
        baseUrl: LIVE_CONFIG.baseUrl,
        projectId: LIVE_CONFIG.projectId,
        auth: createAppUserAuth(LIVE_CONFIG.appUserToken),
        timeoutMs: 45000,
      });

      const forms = await runStep(steps, 'listForms', () => client.listForms());
      const formListing = forms.find((entry) => entry.formId === LIVE_CONFIG.formId);
      if (!formListing) {
        throw new Error(`Form ${LIVE_CONFIG.formId} not visible to App User`);
      }

      const manifestEntries = await runStep(steps, 'getFormManifest', () =>
        client.getFormManifest({ formId: LIVE_CONFIG.formId })
      );
      const formXml = await runStep(steps, 'downloadForm', () =>
        client.downloadForm({ formId: LIVE_CONFIG.formId })
      );
      await runStep(steps, 'loadFormIntoHost', () => latestFormRef.current.loadForm(formXml));
      await waitForTick();
      await waitForTick();

      const snapshotAfterLoad = latestSnapshotRef.current;
      if (snapshotAfterLoad == null) {
        throw new Error('No XForms snapshot observed after load');
      }
      const assignments = planAssignments(snapshotAfterLoad, runLabel);
      if (assignments.length === 0) {
        throw new Error('Could not find a writable value node to mutate');
      }

      const successfulAssignments = [];
      for (const assignment of assignments) {
        await runStep(steps, `setValue:${assignment.reference}`, () =>
          latestFormRef.current.setValue(assignment.reference, assignment.value)
        );
        successfulAssignments.push(assignment);
      }

      await runStep(steps, 'refreshSnapshot', () =>
        latestFormRef.current.refreshSnapshot('m4.5-before-serialize')
      );
      await waitForTick();
      await waitForTick();

      const snapshotAfterMutations = latestSnapshotRef.current;
      const appliedAssignments = successfulAssignments.filter((assignment) =>
        valueMatchesAssignment(snapshotAfterMutations?.nodesByReference?.[assignment.reference], assignment.value)
      );

      const serializeResult = await runStep(steps, 'serialize', () => latestFormRef.current.serialize());
      const submitResult = await runStep(steps, 'submitSerializedInstance', () =>
        client.submit({ xml: serializeResult.xml })
      );

      if (cancelled) {
        return;
      }

      const checks = {
        discoveredTargetForm: formListing.formId === LIVE_CONFIG.formId,
        downloadedFormXml: typeof formXml === 'string' && /<(h:)?html\b/i.test(formXml),
        fetchedManifestSurface: Array.isArray(manifestEntries),
        reactObservedSnapshot: Number(snapshotAfterLoad?.nodeCount ?? 0) > 0,
        appliedAtLeastOneMutation: appliedAssignments.length > 0,
        serializeSucceeded:
          typeof serializeResult?.xml === 'string' && serializeResult.xml.includes('<instanceID>'),
        openRosaSubmitSucceeded: submitResult?.status === 201,
        submitReturnedInstanceId:
          typeof submitResult?.instanceId === 'string' && submitResult.instanceId.startsWith('uuid:'),
      };
      const summary = {
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        durationMs: Date.now() - startedAt,
        phase: latestPhaseRef.current,
        form: {
          formId: formListing.formId,
          version: formListing.version,
          hash: formListing.hash,
        },
        manifestEntryCount: manifestEntries.length,
        serializeStatus: serializeResult?.status ?? null,
        serializeViolationCount: serializeResult?.violationCount ?? null,
        plannedAssignments: assignments,
        appliedAssignments,
        submitResult,
        checks,
        stepOutcomes: steps,
        ok: steps.every((step) => step.ok) && Object.values(checks).every(Boolean),
      };

      clearTimeout(watchdog);
      setSummary(summary);
      pushEvent({ type: 'summary', payload: summary });
      console.log(
        `M45_RUNTIME_DONE::status=${submitResult?.status ?? 'unknown'}::instanceId=${submitResult?.instanceId ?? 'none'}`
      );
      console.log(`M45_RUNTIME_SUMMARY::${JSON.stringify(summary)}`);
      console.log(`M45_RUNTIME_RESULT::${JSON.stringify({ summary })}`);
    };

    const watchdog = setTimeout(() => {
      if (cancelled) {
        return;
      }
      const hangPayload = {
        phase: latestPhaseRef.current,
        snapshotNodeCount: latestSnapshotRef.current?.nodeCount ?? null,
      };
      console.log(`M45_RUNTIME_HANG::${JSON.stringify(hangPayload)}`);
      setSummary({
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        phase: latestPhaseRef.current,
        ok: false,
        hang: true,
      });
      pushEvent({ type: 'hang', payload: hangPayload });
    }, 120000);

    run().catch((error) => {
      if (cancelled) {
        return;
      }
      clearTimeout(watchdog);
      const resolved = error instanceof Error ? error : new Error(String(error));
      console.log(`M45_RUNTIME_CRASH::${resolved.message}`);
      setSummary({
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        phase: latestPhaseRef.current,
        ok: false,
        error: resolved.message,
      });
      pushEvent({
        type: 'scenario-crash',
        payload: {
          message: resolved.message,
          stack: resolved.stack ?? null,
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, [pushEvent, setSummary]);

  return null;
};

export default function M45VerticalSlice() {
  const webViewRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);

  const host = useMemo(
    () =>
      new WebViewXFormsHost({
        webViewRef,
        requestTimeoutMs: 30000,
      }),
    []
  );
  const sidecarHtml = useMemo(() => createWebViewSidecarHtml(), []);

  const pushEvent = useCallback((event) => {
    setEvents((previous) => {
      const next = [...previous, { ...event, timestamp: new Date().toISOString() }];
      if (next.length > MAX_EVENTS) {
        return next.slice(next.length - MAX_EVENTS);
      }
      return next;
    });
  }, []);

  const onMessage = useCallback(
    (event) => {
      host.handleWebViewMessage(event);
    },
    [host]
  );

  return (
    <XFormsProvider host={host}>
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={styles.title}>M4.5 Central → Host → React → Submit gate</Text>
        <Text style={styles.detail}>Platform: {Platform.OS}</Text>
        <Text style={styles.detail}>Hermes: {String(typeof HermesInternal !== 'undefined')}</Text>
        {summary == null ? <Text style={styles.detail}>Running scenario...</Text> : null}
        {summary != null ? (
          <View style={styles.block}>
            <Text style={summary.ok ? styles.ok : styles.fail}>{summary.ok ? 'PASS' : 'FAIL'}</Text>
            <Text style={styles.detail}>Checks: {JSON.stringify(summary.checks ?? {})}</Text>
            {summary.submitResult ? (
              <Text style={styles.detail}>Submit: {JSON.stringify(summary.submitResult)}</Text>
            ) : null}
            {summary.error ? <Text style={styles.fail}>Error: {summary.error}</Text> : null}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.subtitle}>Recent events</Text>
          {events.map((event, index) => (
            <Text key={`${event.timestamp}-${index}`} style={styles.eventLine}>
              {event.timestamp} {event.type}: {JSON.stringify(event.payload)}
            </Text>
          ))}
        </View>

        <ScenarioRunner pushEvent={pushEvent} setSummary={setSummary} />

        <WebView
          ref={webViewRef}
          key="m45-hidden-sidecar"
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
  root: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    padding: 14,
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  detail: {
    color: '#d1d5db',
    fontSize: 12,
    marginBottom: 6,
  },
  ok: {
    color: '#22c55e',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  fail: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  block: {
    marginTop: 10,
    marginBottom: 12,
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  eventLine: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    top: 0,
    left: 0,
  },
});
