import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { runDefaultImportProbe } from './src/probeDefaultImport';

export default function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    runDefaultImportProbe()
      .then((probeResult) => {
        console.log(`M23B_RUNTIME_RESULT::${JSON.stringify({
          ok: probeResult.ok,
          hermes: typeof HermesInternal !== 'undefined',
          steps: probeResult.steps.map((step) => ({ name: step.name, ok: step.ok })),
        })}`);
        if (mounted) {
          setResult(probeResult);
        }
      })
      .catch((caught) => {
        const resolved = caught instanceof Error ? caught : new Error(String(caught));
        console.log(`M23B_RUNTIME_RESULT::${JSON.stringify({
          ok: false,
          hermes: typeof HermesInternal !== 'undefined',
          error: `${resolved.name}: ${resolved.message}`,
        })}`);
        if (mounted) {
          setError(`${resolved.name}: ${resolved.message}`);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.title}>M2.3a Current Expo/Hermes Gate</Text>
      <Text style={styles.text}>{`HermesInternal: ${String(typeof HermesInternal !== 'undefined')}`}</Text>

      {error != null ? <Text style={styles.fail}>{`Probe exception: ${error}`}</Text> : null}
      {result == null && error == null ? <Text style={styles.text}>Running default-import probe...</Text> : null}
      {result != null ? (
        <View>
          <Text style={result.ok ? styles.ok : styles.fail}>{`Overall: ${result.ok ? 'PASS' : 'FAIL'}`}</Text>
          {result.steps.map((step) =>
            step.ok ? (
              <Text key={step.name} style={styles.ok}>{`PASS ${step.name}`}</Text>
            ) : (
              <Text key={step.name} style={styles.fail}>
                {`FAIL ${step.name}: ${step.error.name}: ${step.error.message}`}
              </Text>
            )
          )}
        </View>
      ) : null}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111827',
  },
  container: {
    padding: 12,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  text: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 8,
  },
  ok: {
    color: '#22C55E',
    fontSize: 13,
    marginBottom: 4,
  },
  fail: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 4,
  },
});
