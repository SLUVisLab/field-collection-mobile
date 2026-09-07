import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeRouter, useNavigate } from 'react-router-native';

import { GatherProvider } from '../src/context/GatherProvider.js';
import { AppNavigator } from '../src/navigation/AppNavigator.js';
import { NavProbeContext } from '../src/navigation/NavProbeContext.js';
import {
  SHELL_SCREENS,
  initialEntryForShell,
  visitOrderForShell,
} from '../src/navigation/routes.js';
import { useGather } from '../src/context/GatherContext.js';

/**
 * M5.1 Android navigation gate.
 *
 * Boots the real application (GatherProvider → gather-storage → bootstrap), then
 * programmatically walks every route of BOTH the setup and project shells,
 * recording which screens actually mounted via the NavProbe seam. It seeds +
 * activates a throwaway project to cross from the setup shell into the project
 * shell, exercising the shell-switch path.
 *
 * Emits exactly one terminal marker: M51_NAV_RESULT::{…}
 * plus M51_NAV_CRASH:: / M51_NAV_HANG:: fail-safes. No secrets are ever logged.
 */

const EXPECTED = [
  ...SHELL_SCREENS.setup.map((s) => s.id),
  ...SHELL_SCREENS.project.map((s) => s.id),
];

const GATE_PROJECT = {
  projectKey: 'gate-project',
  displayName: 'Gate Project',
  baseUrl: 'https://gate.invalid',
};

/** Walks a list of paths, one per tick, then calls onComplete. */
function RouteWalker({ steps, onComplete }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= steps.length) {
      const done = setTimeout(onComplete, 150);
      return () => clearTimeout(done);
    }
    navigate(steps[index]);
    const next = setTimeout(() => setIndex((i) => i + 1), 250);
    return () => clearTimeout(next);
  }, [index, steps, navigate, onComplete]);

  return null;
}

function GateHarness() {
  const session = useGather();
  const { status, error, shell, repositories, actions } = session;
  const [phase, setPhase] = useState('booting');
  const visitedRef = useRef(new Set());
  const emittedRef = useRef(false);

  const emit = useCallback((marker, payload) => {
    if (emittedRef.current) return;
    emittedRef.current = true;
    console.log(`${marker}::${JSON.stringify(payload)}`);
  }, []);

  const collector = useRef({
    reportScreen: (id) => visitedRef.current.add(id),
  }).current;

  // Fail-safes.
  useEffect(() => {
    const hang = setTimeout(() => {
      emit('M51_NAV_HANG', { platform: Platform.OS, phase, visited: [...visitedRef.current] });
    }, 25000);
    return () => clearTimeout(hang);
  }, [emit, phase]);

  useEffect(() => {
    if (status === 'error') {
      emit('M51_NAV_CRASH', {
        platform: Platform.OS,
        error: error?.message ?? String(error),
      });
    }
    if (status === 'ready' && phase === 'booting') {
      setPhase('setup-walk');
    }
  }, [status, error, phase, emit]);

  const finishSetupWalk = useCallback(async () => {
    try {
      await repositories.projects.upsertProject(GATE_PROJECT);
      await actions.setActiveProject(GATE_PROJECT.projectKey);
      setPhase('project-walk');
    } catch (e) {
      emit('M51_NAV_CRASH', { platform: Platform.OS, error: e?.message ?? String(e) });
    }
  }, [repositories, actions, emit]);

  const finishProjectWalk = useCallback(() => {
    const visited = [...visitedRef.current];
    const missing = EXPECTED.filter((id) => !visited.includes(id));
    emit('M51_NAV_RESULT', {
      platform: Platform.OS,
      ok: missing.length === 0,
      expected: EXPECTED.length,
      visitedCount: visited.length,
      visited,
      missing,
    });
    setPhase('done');
  }, [emit]);

  if (status !== 'ready') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a66c2" />
        <Text style={styles.muted}>Gate booting… ({status})</Text>
      </View>
    );
  }

  return (
    <NavProbeContext.Provider value={collector}>
      <View style={styles.root} testID="nav-gate">
        {phase === 'setup-walk' && (
          <NativeRouter key="setup" initialEntries={[initialEntryForShell('setup')]}>
            <AppNavigator shell="setup" />
            <RouteWalker steps={visitOrderForShell('setup')} onComplete={finishSetupWalk} />
          </NativeRouter>
        )}
        {phase === 'project-walk' && (
          <NativeRouter key="project" initialEntries={[initialEntryForShell('project')]}>
            <AppNavigator shell="project" />
            <RouteWalker steps={visitOrderForShell('project')} onComplete={finishProjectWalk} />
          </NativeRouter>
        )}
        {(phase === 'seeding' || phase === 'done' || phase === 'booting') && (
          <View style={styles.centered}>
            <Text style={styles.muted}>phase: {phase}</Text>
          </View>
        )}
      </View>
    </NavProbeContext.Provider>
  );
}

export default function ShellNavGateApp() {
  const [fatal, setFatal] = useState(null);
  useEffect(() => {
    const handler = (e) => setFatal(e?.message ?? String(e));
    // Surface unexpected render crashes as a terminal marker for the gate.
    const g = globalThis;
    const prev = g.onunhandledrejection;
    g.onunhandledrejection = (ev) => {
      console.log(
        `M51_NAV_CRASH::${JSON.stringify({
          platform: Platform.OS,
          error: ev?.reason?.message ?? String(ev?.reason),
        })}`
      );
    };
    return () => {
      g.onunhandledrejection = prev;
      void handler;
    };
  }, []);

  if (fatal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>{fatal}</Text>
      </View>
    );
  }

  return (
    <GatherProvider>
      <GateHarness />
    </GatherProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  muted: { color: '#5a5a63', fontSize: 14 },
  err: { color: '#cf222e', fontSize: 14, padding: 24 },
});
