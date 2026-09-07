import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { QrScanner } from '../src/components/camera/QrScanner.js';

export default function NativeQrGateApp() {
  const reported = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!reported.current) {
        reported.current = true;
        console.log('NATIVE_QR_SCANNER_RESULT::PASS');
      }
    }, 5_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>QR scanner native gate</Text>
      <QrScanner
        isActive
        onCode={() => {}}
        onError={() => {
          if (!reported.current) {
            reported.current = true;
            console.log('NATIVE_QR_SCANNER_RESULT::FAIL');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 64 },
  title: { color: '#1b1b1f', fontSize: 20, fontWeight: '700', marginBottom: 16 },
});
