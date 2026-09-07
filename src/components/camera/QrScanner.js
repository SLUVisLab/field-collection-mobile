import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner';

import { scannedCodeValue } from '../../capabilities/camera/scanResult.js';
import { ActionButton } from '../NavButton.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function QrScanner({ isActive, onCode, onError, testID = 'settings-qr-scanner' }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [permissionError, setPermissionError] = useState(null);
  const theme = useTheme();

  const requestAccess = useCallback(async () => {
    setPermissionError(null);
    try {
      await requestPermission();
    } catch {
      setPermissionError('Camera access could not be requested. Use the paste fallback below.');
    }
  }, [requestPermission]);

  const handleScan = useCallback(
    (barcodes) => {
      const value = scannedCodeValue(barcodes);
      if (value) onCode?.(value);
    },
    [onCode]
  );

  if (!hasPermission) {
    return (
      <View
        style={[styles.permission, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md, gap: tokens.spacing.sm, padding: tokens.spacing.md }]}
        testID={`${testID}-permission`}
      >
        <Text style={[styles.message, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>
          Allow camera access to scan a Settings QR code. You can also paste it below.
        </Text>
        {canRequestPermission ? (
          <ActionButton
            label="Allow camera"
            onPress={() => void requestAccess()}
            style={styles.inlineAction}
            testID={`${testID}-request-permission`}
          />
        ) : null}
        {permissionError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
            {permissionError}
          </Text>
        ) : null}
      </View>
    );
  }

  if (!device) {
    return (
      <View
        style={[styles.permission, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md, gap: tokens.spacing.sm, padding: tokens.spacing.md }]}
        testID={`${testID}-unavailable`}
      >
        <Text style={[styles.message, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>
          No camera is available to scan a Settings QR code. You can paste it below.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.scanner, { backgroundColor: theme.colors.cameraChrome, borderRadius: tokens.radii.md }]}>
      <CodeScanner
        isActive={isActive}
        style={styles.camera}
        barcodeFormats={['qr-code']}
        onBarcodeScanned={handleScan}
        onError={() => onError?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: {
    aspectRatio: 1,
    overflow: 'hidden',
    width: '100%',
  },
  camera: { flex: 1 },
  permission: {},
  message: {},
  inlineAction: { alignSelf: 'flex-start' },
  error: {},
});
