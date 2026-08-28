import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Import from a workspace package to prove the packages/* libraries are linked
// and bundled by Metro. The real Gather UI is built out in M5.
import { XFORMS_EVENT_TYPES } from 'odk-xforms-host';

export default function App() {
  const hostEventTypes = Object.keys(XFORMS_EVENT_TYPES).length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gather</Text>
      <Text style={styles.subtitle}>Application shell</Text>
      <Text style={styles.meta}>
        Workspace packages linked ({hostEventTypes} host event types)
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1b1b1f',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#5a5a63',
  },
  meta: {
    marginTop: 24,
    fontSize: 13,
    color: '#8a8a92',
  },
});
