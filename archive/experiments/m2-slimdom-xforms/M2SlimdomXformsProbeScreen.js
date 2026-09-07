import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { runSlimdomXformsHermesProbe } from './xformsHermesProbe';

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

const M2SlimdomXformsProbeScreen = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    runSlimdomXformsHermesProbe()
      .then((probeResult) => {
        if (mounted) {
          setResult(probeResult);
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          const resolved = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
          setError(`${resolved.name}: ${resolved.message}`);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.root}>
      <Text style={styles.title}>M2.3 Slimdom + XForms Hermes Probe</Text>
      <Text style={styles.text}>{`HermesInternal: ${String(typeof HermesInternal !== 'undefined')}`}</Text>

      {error != null ? <Text style={styles.fail}>{`Probe exception: ${error}`}</Text> : null}
      {result == null && error == null ? <Text style={styles.text}>Running probe...</Text> : null}

      {result != null ? (
        <View>
          <Text style={result.ok ? styles.ok : styles.fail}>{`Overall: ${result.ok ? 'PASS' : 'FAIL'}`}</Text>
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

export default M2SlimdomXformsProbeScreen;
