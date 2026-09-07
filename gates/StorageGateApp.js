import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

// Native runtime gate for the `gather-storage` package. Proves the three storage
// technologies (SQLite / FileSystem / SecureStore) work on-device and persist
// across a storage re-open. Run by pointing index.js at this component
// (see gates/README.md). Emits a single terminal marker; never logs secret values.
import {
  CredentialStore,
  GatherPaths,
  closeGatherStorage,
  deleteFile,
  deleteProjectDirectory,
  gatherSchemaVersion,
  initializeGatherStorage,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';

const GATE_PROJECT = 'storagegate';
const bytesEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function runGate() {
  const steps = [];
  const record = (name, ok, detail) => {
    steps.push({ name, ok: Boolean(ok), detail: String(detail ?? '') });
  };

  const textKey = GatherPaths.forms(GATE_PROJECT, 'probe', 'form.xml');
  const binKey = GatherPaths.media(GATE_PROJECT, 'probe.bin');
  const textContent = `<form>gate-${Date.now()}</form>`;
  const binContent = new Uint8Array([0, 1, 2, 3, 250, 255]);
  const probeValue = `probe-${Date.now()}`;
  // A non-empty secret used only in memory; its value is never logged.
  const secret = `gate-secret-${Date.now()}`;

  try {
    // 1. initialize storage → SQLite DB opens.
    const init = await initializeGatherStorage();
    record('initialize storage', !!init.database, 'db handle acquired');

    // 2. migration version is correct.
    const expectedVersion = gatherSchemaVersion();
    const versionRow = await init.database.getFirstAsync('PRAGMA user_version;');
    const userVersion = versionRow ? Number(versionRow.user_version) : -1;
    record(
      'migration version correct',
      userVersion === expectedVersion && init.schemaVersion === expectedVersion,
      `user_version=${userVersion} expected=${expectedVersion}`
    );

    // Foreign keys are enabled on the connection.
    const fkRow = await init.database.getFirstAsync('PRAGMA foreign_keys;');
    record('foreign_keys enabled', fkRow && Number(fkRow.foreign_keys) === 1, `foreign_keys=${fkRow && fkRow.foreign_keys}`);

    // 3. write/read one structured record.
    await init.database.runAsync(
      'INSERT OR REPLACE INTO gather_meta (key, value) VALUES (?, ?);',
      'gate.probe',
      probeValue
    );
    const row = await init.database.getFirstAsync(
      'SELECT value FROM gather_meta WHERE key = ?;',
      'gate.probe'
    );
    record('sqlite write/read record', row && row.value === probeValue, `value matches=${row && row.value === probeValue}`);

    // 4. write/read one durable text file (atomic).
    await writeTextAtomic(textKey, textContent);
    const textBack = await readText(textKey);
    record('filesystem text write/read', textBack === textContent, `bytes=${textBack.length}`);

    // 5. write/read one durable binary file (atomic).
    await writeBytesAtomic(binKey, binContent);
    const binBack = await readBytes(binKey);
    record('filesystem binary write/read', bytesEqual(binBack, binContent), `len=${binBack.length}`);

    // 6. store/read SecureStore token (value never logged).
    await CredentialStore.setProjectToken(GATE_PROJECT, secret);
    const gotToken = await CredentialStore.getProjectToken(GATE_PROJECT);
    record('securestore set/get token', gotToken === secret, `present=${gotToken != null}`);

    // 7. reinitialize (close + reopen) to prove persistence across storage re-open.
    await closeGatherStorage();
    const reinit = await initializeGatherStorage();
    record(
      'reinitialize idempotent',
      reinit.migration.applied.length === 0 && reinit.schemaVersion === expectedVersion,
      `applied=${JSON.stringify(reinit.migration.applied)}`
    );

    // 8. data still exists after re-open.
    const rowAfter = await reinit.database.getFirstAsync(
      'SELECT value FROM gather_meta WHERE key = ?;',
      'gate.probe'
    );
    const textAfter = await readText(textKey);
    const binAfter = await readBytes(binKey);
    const tokenAfter = await CredentialStore.getProjectToken(GATE_PROJECT);
    record(
      'data persists across re-open',
      rowAfter && rowAfter.value === probeValue &&
        textAfter === textContent &&
        bytesEqual(binAfter, binContent) &&
        tokenAfter === secret,
      'sqlite+text+binary+token all persisted'
    );

    // 9 & 10. delete credential → it no longer exists.
    const removed = await CredentialStore.deleteProjectCredentials(GATE_PROJECT);
    const tokenGone = await CredentialStore.getProjectToken(GATE_PROJECT);
    record('credential deleted', removed >= 1 && tokenGone === null, `removed=${removed} nowNull=${tokenGone === null}`);
  } finally {
    // Best-effort cleanup so re-runs start clean (never fail the gate on cleanup).
    try {
      deleteFile(textKey);
      deleteFile(binKey);
      deleteProjectDirectory(GATE_PROJECT);
      await CredentialStore.deleteProjectCredentials(GATE_PROJECT);
      const closable = await initializeGatherStorage();
      await closable.database.runAsync('DELETE FROM gather_meta WHERE key = ?;', 'gate.probe');
    } catch {
      // ignore cleanup errors
    }
  }

  return steps;
}

export default function StorageGateApp() {
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const watchdog = setTimeout(() => {
      console.log('STORAGE_GATE_HANG::' + JSON.stringify({ platform: Platform.OS }));
    }, 30000);
    (async () => {
      try {
        const result = await runGate();
        setSteps(result);
        const passed = result.filter((s) => s.ok).length;
        const failed = result.length - passed;
        const s = { platform: Platform.OS, total: result.length, passed, failed, ok: failed === 0 };
        setSummary(s);
        console.log('STORAGE_GATE_RESULT::' + JSON.stringify({ ...s, steps: result }));
      } catch (e) {
        console.log(
          'STORAGE_GATE_CRASH::' +
            JSON.stringify({ platform: Platform.OS, error: e && e.message ? e.message : String(e) })
        );
      } finally {
        clearTimeout(watchdog);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>gather-storage gate</Text>
      <Text style={styles.subtitle}>{Platform.OS}</Text>
      {summary && (
        <Text style={[styles.badge, summary.ok ? styles.badgeOk : styles.badgeFail]}>
          {summary.ok ? 'PASS' : 'FAIL'} · {summary.passed}/{summary.total}
        </Text>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {steps.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.mark, s.ok ? styles.ok : styles.fail]}>{s.ok ? '✓' : '✗'}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{s.name}</Text>
              <Text style={styles.rowDetail}>{s.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1b1b1f' },
  subtitle: { marginTop: 2, fontSize: 14, color: '#5a5a63' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  badgeOk: { backgroundColor: '#1a7f37' },
  badgeFail: { backgroundColor: '#cf222e' },
  scroll: { marginTop: 16, flex: 1 },
  scrollContent: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  mark: { width: 22, fontSize: 16, fontWeight: '700' },
  ok: { color: '#1a7f37' },
  fail: { color: '#cf222e' },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, color: '#1b1b1f' },
  rowDetail: { fontSize: 12, color: '#8a8a92' },
});
