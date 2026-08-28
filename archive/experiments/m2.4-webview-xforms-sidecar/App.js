import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { REPRESENTATIVE_XFORM_XML } from './src/fixtures/representativeXform';
import { WebViewXFormsHost } from './src/host/WebViewXFormsHost';
import { createWebViewSidecarHtml } from './src/host/createWebViewSidecarHtml';
import {
  XFormsProvider,
  useXForm,
  useXFormsChoices,
  useXFormsQuestion,
  useXFormsRepeat,
} from './src/react';

const MAX_EVENTS = 60;
let scenarioRunStarted = false;

const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const extractHookState = ({ age, calc, extra, name, readonlyNote, choice, repeat }) => ({
  age: age.value,
  calc: calc.value,
  extraRelevant: extra.relevant,
  ageConstraintValid: age.constraintValid,
  nameRequired: name.required,
  readonlyNoteReadonly: readonlyNote.readonly,
  choiceValue: choice.value,
  repeatCount: repeat.instances.length,
});

const ScenarioRunner = ({ pushEvent, setSummary }) => {
  const form = useXForm();
  const name = useXFormsQuestion('/data/name');
  const age = useXFormsQuestion('/data/age');
  const calc = useXFormsQuestion('/data/calc');
  const extra = useXFormsQuestion('/data/extra');
  const readonlyNote = useXFormsQuestion('/data/readonly_note');
  const choice = useXFormsChoices('/data/choice');
  const repeat = useXFormsRepeat('/data/rep');

  const [scenarioError, setScenarioError] = useState(null);
  const startedRef = useRef(false);
  const latestHookStateRef = useRef(null);
  const latestPhaseRef = useRef(form.phase);
  const latestFormRef = useRef(form);
  const latestRepeatRef = useRef(repeat);
  latestPhaseRef.current = form.phase;
  latestFormRef.current = form;
  latestRepeatRef.current = repeat;

  latestHookStateRef.current = extractHookState({
    age,
    calc,
    extra,
    name,
    readonlyNote,
    choice,
    repeat,
  });

  useEffect(() => {
    pushEvent({
      type: 'hook-state',
      payload: latestHookStateRef.current,
    });
  }, [
    age.value,
    calc.value,
    extra.relevant,
    age.constraintValid,
    name.required,
    readonlyNote.readonly,
    choice.value,
    repeat.instances.length,
    pushEvent,
  ]);

  useEffect(() => {
    if (startedRef.current || scenarioRunStarted) {
      return;
    }
    startedRef.current = true;
    scenarioRunStarted = true;

    let cancelled = false;
    const runStep = async (steps, name, operation) => {
      console.log(`M3_RUNTIME_STEP_START::${name}`);
      try {
        const value = await operation();
        steps.push({ name, ok: true });
        console.log(`M3_RUNTIME_STEP_OK::${name}`);
        return value;
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        steps.push({
          name,
          ok: false,
          error: resolved.message,
        });
        console.log(`M3_RUNTIME_STEP_FAIL::${name}::${resolved.message}`);
        return null;
      }
    };

    const run = async () => {
      const currentForm = latestFormRef.current;
      const currentRepeat = latestRepeatRef.current;
      const steps = [];
      const startedAt = Date.now();
      const initialRepeatCount =
        typeof latestHookStateRef.current?.repeatCount === 'number'
          ? latestHookStateRef.current.repeatCount
          : null;
      await runStep(steps, 'loadForm', () => currentForm.loadForm(REPRESENTATIVE_XFORM_XML));
      await runStep(steps, 'setValue age=19', () => currentForm.setValue('/data/age', 19));
      await runStep(steps, 'setValue height=2.5', () => currentForm.setValue('/data/height', 2.5));
      await runStep(steps, 'setValue show_extra=1', () => currentForm.setValue('/data/show_extra', 1));
      await runStep(steps, 'setValue choice=apple', () => currentForm.setValue('/data/choice', 'apple'));
      await runStep(steps, 'setValue age=17', () => currentForm.setValue('/data/age', 17));
      await runStep(steps, 'addRepeat(/data/rep)', () => currentRepeat.add());
      const serializeResult = await runStep(steps, 'serialize', () => currentForm.serialize());
      const mediaResult = await runStep(steps, 'inspectMediaSeam', () => currentForm.inspectMediaSeam());
      await runStep(steps, 'refreshSnapshot', () => currentForm.refreshSnapshot('m3-summary'));

      await waitForTick();
      await waitForTick();

      if (cancelled) {
        return;
      }
      const finalHookState = latestHookStateRef.current ?? {};
      const repeatStep = steps.find((step) => step.name === 'addRepeat(/data/rep)');
      const checks = {
        valuesUpdated: finalHookState.age === '17',
        calculateUpdated: Number(finalHookState.calc ?? Number.NaN) === 19.5,
        relevanceUpdated: finalHookState.extraRelevant === true,
        constraintUpdated: finalHookState.ageConstraintValid === false,
        requiredReflected: finalHookState.nameRequired === true,
        readonlyReflected: finalHookState.readonlyNoteReadonly === true,
        choiceReflected:
          Array.isArray(finalHookState.choiceValue) && finalHookState.choiceValue.includes('apple'),
        repeatUpdated:
          repeatStep?.ok === true &&
          initialRepeatCount != null &&
          typeof finalHookState.repeatCount === 'number' &&
          finalHookState.repeatCount > initialRepeatCount,
        serializationHasFixture:
          typeof serializeResult?.xml === 'string' && serializeResult.xml.includes('m2_4_fixture'),
        mediaReferenceModel: typeof mediaResult?.note === 'string',
      };
      const allStepsOk = steps.every((step) => step.ok);
      const allChecksOk = Object.values(checks).every(Boolean);
      const summary = {
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        durationMs: Date.now() - startedAt,
        phase: latestPhaseRef.current,
        checks,
        stepOutcomes: steps,
        hookState: finalHookState,
        ok: allStepsOk && allChecksOk,
      };
      clearTimeout(watchdog);
      setSummary(summary);
      pushEvent({
        type: 'summary',
        payload: summary,
      });
      console.log(`M3_RUNTIME_SUMMARY::${JSON.stringify(summary)}`);
      console.log(`M3_RUNTIME_RESULT::${JSON.stringify({ summary, serializeResult, mediaResult })}`);
    };

    const watchdog = setTimeout(() => {
      if (cancelled) {
        return;
      }
      const hangPayload = {
        phase: latestPhaseRef.current,
        hookState: latestHookStateRef.current,
      };
      console.log(`M3_RUNTIME_HANG::${JSON.stringify(hangPayload)}`);
      pushEvent({
        type: 'hang',
        payload: hangPayload,
      });
      setSummary({
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        durationMs: 45000,
        phase: latestPhaseRef.current,
        checks: {},
        stepOutcomes: [],
        hookState: latestHookStateRef.current,
        ok: false,
        hang: true,
      });
    }, 45000);

    run().catch((error) => {
      if (cancelled) {
        return;
      }
      clearTimeout(watchdog);
      const resolved = error instanceof Error ? error : new Error(String(error));
      console.log(`M3_RUNTIME_CRASH::${resolved.message}`);
      setScenarioError(resolved.message);
      pushEvent({
        type: 'scenario-crash',
        payload: {
          message: resolved.message,
          stack: resolved.stack ?? null,
        },
      });
    });

    return () => {
      clearTimeout(watchdog);
      cancelled = true;
    };
  }, [pushEvent, setSummary]);

  if (scenarioError != null) {
    return <Text style={styles.fail}>Scenario error: {scenarioError}</Text>;
  }
  return null;
};

export default function App() {
  const webViewRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);

  const host = useMemo(
    () =>
      new WebViewXFormsHost({
        webViewRef,
        requestTimeoutMs: 20000,
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
        <Text style={styles.title}>M3 React bindings + XFormsHost gate</Text>
        <Text style={styles.detail}>Platform: {Platform.OS}</Text>
        <Text style={styles.detail}>Hermes: {String(typeof HermesInternal !== 'undefined')}</Text>
        {summary == null ? <Text style={styles.detail}>Running scenario...</Text> : null}
        {summary != null ? (
          <View style={styles.block}>
            <Text style={summary.ok ? styles.ok : styles.fail}>{summary.ok ? 'PASS' : 'FAIL'}</Text>
            <Text style={styles.detail}>Checks: {JSON.stringify(summary.checks)}</Text>
            <Text style={styles.detail}>Hook state: {JSON.stringify(summary.hookState)}</Text>
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
          key="m3-hidden-sidecar"
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
