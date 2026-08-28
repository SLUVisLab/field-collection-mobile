import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { capturePhoto } from '../src/capabilities/camera/capturePhoto.js';
import { CameraViewport } from '../src/components/camera/CameraViewport.js';

export default function NativeCameraGateApp() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', quality: 0.8 });
  const captureStarted = useRef(false);
  const [status, setStatus] = useState('Requesting camera permission');

  const capture = useCallback(async () => {
    if (captureStarted.current) return;
    captureStarted.current = true;
    setStatus('Capturing photo');
    try {
      const result = await capturePhoto({ photoOutput });
      if (!result.file || !result.uri || result.contentType !== 'image/jpeg') {
        throw new Error('Camera result was missing its local-file contract.');
      }
      setStatus('Camera capture passed');
      console.log('NATIVE_CAMERA_RESULT::PASS');
    } catch (error) {
      setStatus('Camera capture failed');
      console.log(`NATIVE_CAMERA_RESULT::FAIL:${error?.message ?? 'unknown'}`);
    }
  }, [photoOutput]);

  const request = useCallback(async () => {
    try {
      await requestPermission();
    } catch (error) {
      setStatus('Camera permission failed');
      console.log(`NATIVE_CAMERA_RESULT::FAIL:${error?.message ?? 'unknown'}`);
    }
  }, [requestPermission]);

  useEffect(() => {
    if (!hasPermission) void request();
  }, [hasPermission, request]);

  return (
    <View style={styles.root}>
      <Text style={styles.title} testID="native-camera-status">{status}</Text>
      {hasPermission ? (
        <CameraViewport
          photoOutput={photoOutput}
          isActive
          onError={() => console.log('NATIVE_CAMERA_RESULT::FAIL:preview')}
          onUnavailable={() => console.log('NATIVE_CAMERA_RESULT::UNAVAILABLE')}
          onPreviewStarted={() => void capture()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 64 },
  title: { color: '#1b1b1f', fontSize: 20, fontWeight: '700', marginBottom: 16 },
});
