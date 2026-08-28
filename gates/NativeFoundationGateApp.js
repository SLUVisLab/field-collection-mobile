import { StyleSheet, Text, View } from 'react-native';

import { GatherMap } from '../src/components/maps/GatherMap.js';

const ST_LOUIS = [-90.1994, 38.627];

export default function NativeFoundationGateApp() {
  return (
    <View style={styles.root}>
      <Text style={styles.title} testID="native-foundation-ready">
        Native foundation gate
      </Text>
      <GatherMap
        centerCoordinate={ST_LOUIS}
        points={[{ id: 'st-louis', coordinate: ST_LOUIS }]}
        onDidFinishLoadingMap={() => console.log('NATIVE_FOUNDATION_MAP_RESULT::PASS')}
        testID="native-foundation-map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 64 },
  title: { color: '#1b1b1f', fontSize: 20, fontWeight: '700', marginBottom: 16 },
});
