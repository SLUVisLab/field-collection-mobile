import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import * as hashing from 'gather-hashing';
import { runHashingVectors } from 'gather-hashing/vectors';

/**
 * The digest compatibility contract, **on Hermes**.
 *
 * Node proves the vectors in `npm run test:unit`, but Node is not the runtime
 * that writes them: `instance_receipts.revision` and the installed model
 * directory names are produced on device. The specific risk is number
 * formatting — `1e+21`, `1e-7`, `-0` — where an engine with its own
 * `Number::toString` would silently disagree with the golden values and orphan
 * every installed model.
 *
 * So this runs the *same* `runHashingVectors` the Node test and the browser
 * page run, against the same module, and prints a marker.
 *
 * ```bash
 * # point index.js here, then:
 * adb logcat -v time ReactNativeJS:V '*:S' | grep HASHING_VECTORS
 * ```
 *
 * Expected: `"failures":[]` and a `runtime` of `hermes`.
 */
export default function HashingVectorsGateApp() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const outcome = runHashingVectors(hashing);
    setResult(outcome);
    console.log(`HASHING_VECTORS::${JSON.stringify(outcome)}`);
  }, []);

  if (!result) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Running vectors…</Text>
      </View>
    );
  }

  const total = result.passed + result.failures.length;
  const ok = result.failures.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.headline, ok ? styles.ok : styles.bad]}>
        {ok ? `all ${total} vectors pass` : `${result.failures.length} of ${total} FAILED`}
      </Text>
      <Text style={styles.text}>runtime: {result.runtime}</Text>
      {result.failures.map((failure) => (
        <Text key={failure.case} style={[styles.text, styles.bad]}>
          {failure.case} — {failure.detail}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0e11' },
  content: { padding: 24, paddingTop: 72, gap: 8 },
  headline: { fontSize: 20, fontWeight: '700' },
  text: { color: '#e8eae6', fontSize: 13 },
  ok: { color: '#69b98f' },
  bad: { color: '#e2725b' },
});
