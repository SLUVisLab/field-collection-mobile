import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, Modal } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const VideoAction = ({ existingData, onComplete, task, item, collection }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [videoURI, setVideoURI] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const recordingPromiseRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0); //tracking time in ms
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (existingData?.data?.[task.dataLabel]) {
      setVideoURI(existingData.data[task.dataLabel]);
      setIsReviewing(true);
    }
  }, [existingData]);

  const toggleCameraFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const handleRecordPress = async () => {
    if (!cameraRef.current) return;
  
    if (isRecording) {
      // Stop recording safely

      clearInterval(timerRef.current);
      timerRef.current = null;

      try {
        await cameraRef.current.stopRecording(); // will resolve recordAsync
      } catch (e) {
        console.warn('Tried to stop recording, but something went wrong:', e);
      }
      setIsRecording(false);
      return;
    }
  
    try {
      setElapsedTime(0);
      setIsRecording(true);
      startTimeRef.current = Date.now();
    
      timerRef.current = setInterval(() => {
        const now = Date.now();
        setElapsedTime(now - startTimeRef.current);
      }, 100)

      recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: 60 });
      const video = await recordingPromiseRef.current;
      const relativePath = video.uri.replace(FileSystem.cacheDirectory, '');
      setVideoURI(relativePath);
      setIsReviewing(true);
    } catch (err) {
      console.error('Recording error:', err);
    } finally {
      setIsRecording(false);
      recordingPromiseRef.current = null;
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const saveVideo = () => {
    onComplete({ [task.dataLabel]: videoURI });
  };

  const discardVideo = () => {
    setVideoURI(null);
    setIsReviewing(false);
    setElapsedTime(0);
  };

    // Handle loading state
    if (!permission || !microphonePermission) return <View />;

    // If either permission is not granted, prompt for both
    if (!permission.granted || !microphonePermission.granted) {
        const requestBothPermissions = async () => {
            await requestPermission();
            await requestMicrophonePermission();
        };

        return (
            <View style={styles.container}>
            <Text style={{ textAlign: 'center', marginBottom: 20 }}>
                We need your permission to use the camera and microphone
            </Text>
            <TouchableOpacity onPress={requestBothPermissions} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
            </View>
        );
    }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.info}>
        {collection.parentName && <Text style={styles.infoText}>{collection.parentName}</Text>}
        <Text style={styles.infoText}>{collection.name}</Text>
        <Text style={styles.infoText}>{item.name}</Text>
      </View>

      {isReviewing && videoURI ? (
        <View style={{ flex: 1 }}>
          <Video
            ref={videoRef}
            source={{ uri: `${FileSystem.cacheDirectory}${videoURI}` }}
            style={styles.videoPlayer}
            useNativeControls
            resizeMode="contain"
            shouldPlay={false}
          />
          <View style={styles.photoActionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={saveVideo}>
              <Text style={styles.actionButtonText}>Keep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={discardVideo}>
              <Text style={styles.actionButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <CameraView
          mode="video"
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          videoStabilizationMode="auto"
        >
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
            {String(Math.floor(elapsedTime / 60000)).padStart(2, '0')}:
            {String(Math.floor((elapsedTime % 60000) / 1000)).padStart(2, '0')}:
            {String(Math.floor((elapsedTime % 1000) / 10)).padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={58} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleRecordPress}
                style={[
                    styles.captureButton,
                    isRecording ? styles.captureButtonRecording : styles.captureButtonIdle
                ]}
            >
                <Ionicons name={isRecording ? 'square' : 'ellipse'} size={36} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpButton} onPress={() => setShowInstructions(true)}>
              <Text style={styles.buttonText}>?</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}

      <Modal visible={showInstructions} transparent animationType="slide">
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{task.instructions}</Text>
            <TouchableOpacity
              style={{ ...styles.openButton, backgroundColor: '#2196F3' }}
              onPress={() => setShowInstructions(false)}
            >
              <Text style={styles.textStyle}>Hide Instructions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  videoPlayer: { flex: 1, alignSelf: 'stretch' },
  camera: { flex: 1 },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    padding: 10,
  },
  captureButton: {
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  
  captureButtonIdle: {
    backgroundColor: '#F2F2F2',
  },
  
  captureButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  timerContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  
  timerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  flipButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    borderRadius: 5,
    margin: 5,
    height: 50,
    width: 50,
  },
  buttonText: { color: 'black' },
  info: { position: 'absolute', top: 20, left: 10, width: 500, zIndex: 1 },
  infoText: { color: 'white', fontWeight: 'bold', fontSize: 22 },
  photoActionButtons: {
    marginVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 10,
    alignSelf: 'stretch',
    marginHorizontal: 20,
  },
  actionButton: {
    backgroundColor: '#ffffffdd',
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  actionButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  centeredView: {
    flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 22,
  },
  modalView: {
    margin: 20, backgroundColor: 'white', borderRadius: 20, padding: 35, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  openButton: {
    backgroundColor: '#F194FF', borderRadius: 20, padding: 10, elevation: 2,
  },
  textStyle: { color: 'white' },
  modalText: { fontSize: 16, marginBottom: 15 },
});

export default VideoAction;
