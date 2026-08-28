import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function CameraViewport({ photoOutput, isActive, onError, onPreviewStarted, onUnavailable }) {
  const device = useCameraDevice('back');
  const theme = useTheme();

  useEffect(() => {
    if (!device) onUnavailable?.();
  }, [device, onUnavailable]);

  if (!device) {
    return null;
  }

  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.cameraChrome, borderRadius: tokens.radii.md }]}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive}
        outputs={[photoOutput]}
        onError={() => onError?.()}
        onPreviewStarted={onPreviewStarted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    width: '100%',
  },
  camera: { flex: 1 },
});
