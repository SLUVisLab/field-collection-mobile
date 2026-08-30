import { useCallback, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { ActionButton } from '../actions/ActionButton.jsx';

/**
 * Shared, presentational capture surface: a full-width viewport frame, a
 * centered shutter, flash feedback, and permission/error affordances.
 *
 * It renders identically on every platform. The live preview itself is passed
 * in as `viewport` (a platform `<Camera>` on native, a `<video>` on web) and the
 * capture mechanics are provided by the caller, so this component holds no
 * device- or DOM-specific code.
 */
export function CaptureView({
  viewport,
  onCapture,
  capturing = false,
  error = null,
  permission = null,
  onCancel = null,
  testIDPrefix = 'camera',
}) {
  const theme = useTheme();
  const flash = useRef(new Animated.Value(0)).current;

  const handleCapture = useCallback(() => {
    if (capturing) return;
    flash.setValue(0.9);
    Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    onCapture?.();
  }, [capturing, flash, onCapture]);

  if (permission) {
    return (
      <View
        style={[styles.permission, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md }]}
        testID={`${testIDPrefix}-permission`}
      >
        <Text style={[styles.permissionText, { color: theme.colors.text }]}>{permission.message}</Text>
        {permission.canRequest ? (
          <ActionButton
            label="Allow camera"
            onPress={permission.onRequest}
            style={styles.inlineAction}
            testID={`${testIDPrefix}-request-permission`}
          />
        ) : null}
        {onCancel ? (
          <ActionButton
            label="Cancel"
            onPress={onCancel}
            variant="secondary"
            style={styles.inlineAction}
            testID={`${testIDPrefix}-cancel`}
          />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.capture}>
      <View style={[styles.viewportWrap, { backgroundColor: theme.colors.cameraChrome, borderRadius: tokens.radii.md }]}>
        {viewport}
        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
          {error}
        </Text>
      ) : null}
      <View style={styles.shutterRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={capturing ? 'Taking photo' : 'Take photo'}
          disabled={capturing}
          onPress={handleCapture}
          testID={`${testIDPrefix}-capture`}
          style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed, capturing && styles.shutterDisabled]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
      {onCancel ? (
        <ActionButton label="Cancel" onPress={onCancel} variant="secondary" style={styles.inlineAction} testID={`${testIDPrefix}-cancel`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  capture: { gap: tokens.spacing.sm },
  permission: { gap: tokens.spacing.sm, padding: tokens.spacing.md },
  permissionText: { lineHeight: tokens.typography.bodyLineHeight },
  inlineAction: { alignSelf: 'center' },
  error: { lineHeight: tokens.typography.bodyLineHeight },
  viewportWrap: { position: 'relative', width: '100%', aspectRatio: 3 / 4, overflow: 'hidden' },
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
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cccccc' },
  shutterPressed: { opacity: 0.6 },
  shutterDisabled: { opacity: 0.4 },
});
