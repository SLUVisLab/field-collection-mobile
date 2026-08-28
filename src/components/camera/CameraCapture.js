import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { capturePhoto } from '../../capabilities/camera/capturePhoto.js';
import { ActionButton } from '../NavButton.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { CameraControls } from './CameraControls.js';
import { CameraViewport } from './CameraViewport.js';

export function CameraCapture({ onCaptured, onCancel, testIDPrefix = 'camera' }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', quality: 0.9 });
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();

  const requestAccess = useCallback(async () => {
    setError(null);
    try {
      await requestPermission();
    } catch {
      setError('Camera access could not be requested. You can enable it in system settings.');
    }
  }, [requestPermission]);

  const takePhoto = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const capture = await capturePhoto({ photoOutput });
      await onCaptured?.(capture);
    } catch {
      setError('Could not capture a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured, photoOutput]);

  if (!hasPermission) {
    return (
      <View
        style={[styles.permission, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md, gap: tokens.spacing.sm, padding: tokens.spacing.md }]}
        testID={`${testIDPrefix}-permission`}
      >
        <Text style={[styles.permissionText, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>
          Camera access is needed to take a photo. You can still continue without attaching one.
        </Text>
        {canRequestPermission ? (
          <ActionButton
            label="Allow camera"
            onPress={() => void requestAccess()}
            style={styles.inlineAction}
            testID={`${testIDPrefix}-request-permission`}
          />
        ) : null}
        {onCancel ? (
          <ActionButton
            label="Cancel"
            onPress={onCancel}
            style={styles.inlineAction}
            testID={`${testIDPrefix}-cancel`}
            variant="secondary"
          />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.capture, { gap: tokens.spacing.sm }]}>
      <CameraViewport
        photoOutput={photoOutput}
        isActive
        onError={() => setError('Camera preview is unavailable.')}
        onUnavailable={() => setError('No camera is available on this device.')}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
          {error}
        </Text>
      ) : null}
      <CameraControls
        captureLabel={capturing ? 'Taking photo…' : 'Take photo'}
        captureDisabled={capturing}
        onCapture={takePhoto}
        onCancel={onCancel}
        testIDPrefix={testIDPrefix}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  capture: {},
  permission: {},
  permissionText: {},
  inlineAction: { alignSelf: 'flex-start' },
  error: {},
});
