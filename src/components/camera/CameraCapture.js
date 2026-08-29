import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { capturePhoto } from '../../capabilities/camera/capturePhoto.js';
import { ActionButton } from '../NavButton.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { CameraViewport } from './CameraViewport.js';

export function CameraCapture({ onCaptured, onCancel, testIDPrefix = 'camera' }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', quality: 0.9 });
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const flash = useRef(new Animated.Value(0)).current;

  const triggerFlash = useCallback(() => {
    flash.setValue(0.9);
    Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [flash]);

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
    triggerFlash();
    try {
      const capture = await capturePhoto({ photoOutput });
      await onCaptured?.(capture);
    } catch {
      setError('Could not capture a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured, photoOutput, triggerFlash]);

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
      <View style={styles.viewportWrap}>
        <CameraViewport
          photoOutput={photoOutput}
          isActive
          onError={() => setError('Camera preview is unavailable.')}
          onUnavailable={() => setError('No camera is available on this device.')}
        />
        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
          {error}
        </Text>
      ) : null}
      <View style={styles.shutterRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={capturing ? 'Taking photo' : 'Take photo'}
          disabled={capturing}
          onPress={() => void takePhoto()}
          testID={`${testIDPrefix}-capture`}
          style={({ pressed }) => [
            styles.shutterOuter,
            pressed && styles.shutterPressed,
            capturing && styles.shutterDisabled,
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
      {onCancel ? (
        <ActionButton
          label="Cancel"
          onPress={onCancel}
          variant="secondary"
          style={styles.inlineAction}
          testID={`${testIDPrefix}-cancel`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  capture: {},
  permission: {},
  permissionText: {},
  inlineAction: { alignSelf: 'center' },
  error: {},
  viewportWrap: { position: 'relative', width: '100%' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ffffff' },
  shutterRow: { alignItems: 'center', paddingVertical: tokens.spacing.sm },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#444444',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  shutterPressed: { opacity: 0.6 },
  shutterDisabled: { opacity: 0.4 },
});
