import { useCallback, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';
import { Button } from '../actions/Button.jsx';

/**
 * Shared, presentational camera surface: a full-width viewport frame, a control
 * row (a centered photo shutter by default, or a caller-supplied `control` such
 * as a record button), flash feedback, and permission/error affordances.
 *
 * It renders identically on every platform. The live preview is passed in as
 * `viewport` (a platform `<Camera>` on native, a `<video>` on web); the capture
 * mechanics are the caller's, so this component holds no device/DOM code. Both
 * `CameraView` and `VideoView` render it so photo and video framing never drift.
 */
export function CameraFrame({
  viewport,
  onCapture,
  capturing = false,
  captureDisabled = false,
  notice = null,
  error = null,
  permission = null,
  onCancel = null,
  control = null,
  leading = null,
  trailing = null,
  testIDPrefix = 'camera',
}) {
  const theme = useTheme();
  const flash = useRef(new Animated.Value(0)).current;

  const handleCapture = useCallback(() => {
    // A shutter that cannot append must not capture either: the caller's
    // `onCapture` being absent used to leave the shutter live, so a tap at the
    // maximum still ran the device capture and silently dropped the result.
    if (capturing || captureDisabled) return;
    flash.setValue(0.9);
    Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    onCapture?.();
  }, [captureDisabled, capturing, flash, onCapture]);

  if (permission) {
    return (
      <View
        style={[styles.permission, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md }]}
        testID={`${testIDPrefix}-permission`}
      >
        <Text style={[styles.permissionText, { color: theme.colors.text }]}>{permission.message}</Text>
        {permission.canRequest ? (
          <Button
            label="Allow camera"
            onPress={permission.onRequest}
            style={styles.inlineAction}
            testID={`${testIDPrefix}-request-permission`}
          />
        ) : null}
        {onCancel ? (
          <Button
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
      {notice ? (
        // Beside the shutter, not below the frame: a limit message under the
        // whole camera is off-screen on a phone, which is where it was.
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: theme.colors.textMuted }]}
          testID={`${testIDPrefix}-notice`}
        >
          {notice}
        </Text>
      ) : null}
      <View style={styles.shutterRow}>
        <View style={styles.shutterSide}>{leading}</View>
        {control ?? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              captureDisabled ? 'Photo limit reached' : capturing ? 'Taking photo' : 'Take photo'
            }
            accessibilityState={{ disabled: capturing || captureDisabled }}
            disabled={capturing || captureDisabled}
            onPress={handleCapture}
            testID={`${testIDPrefix}-capture`}
            style={({ pressed }) => [
              styles.shutterOuter,
              pressed && styles.shutterPressed,
              (capturing || captureDisabled) && styles.shutterDisabled,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        )}
        <View style={[styles.shutterSide, styles.shutterSideEnd]}>{trailing}</View>
      </View>
      {onCancel ? (
        <Button label="Cancel" onPress={onCancel} variant="secondary" style={styles.inlineAction} testID={`${testIDPrefix}-cancel`} />
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
  // The native camera preview is a platform surface, so a plain sibling is
  // composited underneath it on Android and the flash is never seen.
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    elevation: 8,
    zIndex: 8,
  },
  shutterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  // Equal-weight sides keep the shutter centred with or without accessories.
  shutterSide: { alignItems: 'flex-start', flex: 1 },
  shutterSideEnd: { alignItems: 'flex-end' },
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
