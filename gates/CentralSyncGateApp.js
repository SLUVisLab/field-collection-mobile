import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import App from '../App';
import { GatherProvider } from '../src/context/GatherProvider.js';
import { useGather } from '../src/context/GatherContext.js';
import { CENTRAL_LIVE } from './fixtures/centralLive.js';

/**
 * The last unproven link: a composition the binary has never seen, arriving
 * **from real ODK Central**, through the ordinary form-resource path.
 *
 * Everything else is already proved. This one provisions against the live
 * Central project with an App User token, refreshes forms, and then mounts the
 * shipped `App` unmodified — so what runs afterwards is the real shell, the
 * real `FormRunner`, and the real composition loader reading a resource that
 * Central served as `application/octet-stream`.
 *
 * ```text
 * Central  gather_packaging_gate + flower_v1.gather  (itext-declared, opaque)
 *     ↓ refreshForms
 * cached form version + resource
 *     ↓ FormRunner
 * gather:composition="flower_v1.gather" on /data/photo
 *     ↓ compositionBinding
 * outputs image, note  →  the group's own body-backed children
 * ```
 *
 * Navigate to Forms → "Gather composition packaging gate" → Fill out form. The
 * composition should render from the downloaded artifact.
 *
 * `gates/fixtures/centralLive.js` carries the credentials and is gitignored.
 * Regenerate it from `central-live.env`; it is deliberately not committed.
 *
 * ```bash
 * adb logcat -v time ReactNativeJS:V '*:S' | grep CENTRAL_SYNC
 * ```
 */
function Bootstrap({ onReady }) {
  const { status: gatherStatus, actions } = useGather();
  const [status, setStatus] = useState('provisioning');
  const [detail, setDetail] = useState(null);
  // Dev-mode effects double-invoke, and two provisions racing each other lose:
  // the second one re-provisions the project the first just wrote and the
  // persistence step fails. Once per mount is what this gate means.
  const started = useRef(false);

  useEffect(() => {
    if (gatherStatus !== 'ready' || started.current) return undefined;
    started.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        setStatus('provisioning');
        const already = (await actions.listProjects()).find(
          (project) =>
            project.baseUrl === CENTRAL_LIVE.baseUrl &&
            String(project.centralProjectId) === String(CENTRAL_LIVE.projectId)
        );
        if (already) {
          if (!already.isActive) await actions.switchProject(already.projectKey);
        } else {
          await actions.provisionManual({
            baseUrl: CENTRAL_LIVE.baseUrl,
            projectId: CENTRAL_LIVE.projectId,
            token: CENTRAL_LIVE.token,
            displayName: 'Central sync gate',
          });
        }

        // Timed on purpose. A stuck screen during an earlier run got read as a
        // slow refresh; it measures 1.1s warm, and the difference between those
        // two stories is a measurement.
        setStatus('refreshing forms');
        const startedAt = Date.now();
        const result = await actions.refreshForms();
        const elapsedMs = Date.now() - startedAt;
        const refreshed = { elapsedMs, formsRefreshed: result?.refreshed?.length ?? null };
        console.log(`CENTRAL_SYNC_REFRESH::${JSON.stringify(refreshed)}`);
        const cached = await actions.listCachedForms();
        const gate = cached.find((form) => form.formId === CENTRAL_LIVE.formId) ?? null;
        const outcome = {
          provisioned: true,
          refreshed,
          formsCached: cached.map((form) => form.formId),
          gateForm: gate
            ? {
                formId: gate.formId,
                sourceVersion: gate.sourceVersion,
                resources: (gate.resources ?? []).map((r) => ({
                  filename: r.filename,
                  contentType: r.contentType,
                })),
              }
            : null,
        };
        if (cancelled) return;
        setDetail(outcome);
        console.log(`CENTRAL_SYNC::${JSON.stringify(outcome)}`);
        setStatus(gate ? 'ready' : 'gate form not cached');
        if (gate) onReady();
      } catch (error) {
        if (cancelled) return;
        setStatus('failed');
        const chain = [];
        for (let e = error; e; e = e.cause) {
          chain.push({ name: e.name, code: e.code, message: e.message, stage: e.stage, details: e.details });
        }
        setDetail({ chain });
        console.log(`CENTRAL_SYNC::${JSON.stringify({ failed: true, chain })}`);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, gatherStatus, onReady]);

  return (
    <View style={styles.screen}>
      <Text style={styles.headline}>Central sync gate</Text>
      <Text style={styles.text}>{status}</Text>
      {status !== 'failed' && status !== 'gate form not cached' ? (
        <ActivityIndicator color="#69b98f" />
      ) : null}
      {detail ? <Text style={styles.detail}>{JSON.stringify(detail, null, 2)}</Text> : null}
    </View>
  );
}

export default function CentralSyncGateApp() {
  // Once the sync has landed, the bootstrap provider unmounts and the shipped
  // `App` mounts its own — so everything after this point is the real shell
  // rather than anything the gate arranged.
  const [synced, setSynced] = useState(false);
  if (synced) return <App />;
  return (
    <GatherProvider>
      <Bootstrap onReady={() => setSynced(true)} />
    </GatherProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0e11', padding: 24, paddingTop: 80, gap: 12 },
  headline: { color: '#e8eae6', fontSize: 20, fontWeight: '700' },
  text: { color: '#69b98f', fontSize: 15 },
  detail: { color: '#99a29f', fontSize: 11, fontFamily: 'monospace' },
});
