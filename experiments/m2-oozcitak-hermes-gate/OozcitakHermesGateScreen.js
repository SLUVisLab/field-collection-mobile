import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { runOozcitakHermesGateProbe } from './probeLogic';

const styles = {
  root: {
    flex: 1,
    backgroundColor: '#111827',
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
};

const OozcitakHermesGateScreen = () => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(runOozcitakHermesGateProbe());
  }, []);

  return (
    <ScrollView style={styles.root}>
      <Text style={styles.title}>M2.0 Oozcitak Hermes Gate</Text>
      <Text style={styles.text}>{`HermesInternal: ${String(typeof HermesInternal !== 'undefined')}`}</Text>

      {result == null ? <Text style={styles.text}>Running probe...</Text> : null}
      {result != null ? (
        <View>
          <Text style={result.ok ? styles.ok : styles.fail}>{`Overall: ${result.ok ? 'PASS' : 'FAIL'}`}</Text>
          <Text style={styles.text}>{`Issue #22 pattern detected: ${String(result.issue22Reproduced)}`}</Text>
          {result.steps.map((step) => {
            if (step.ok) {
              return <Text key={step.name} style={styles.ok}>{`PASS ${step.name}`}</Text>;
            }
            return (
              <Text key={step.name} style={styles.fail}>
                {`FAIL ${step.name}: ${step.error.name}: ${step.error.message}`}
              </Text>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
};

export default OozcitakHermesGateScreen;

