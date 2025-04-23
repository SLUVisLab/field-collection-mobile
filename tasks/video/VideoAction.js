import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const VideoAction = ({ navigation, existingData, onComplete, task, item, collection }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [videoURI, setVideoURI] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (existingData?.data?.[task.dataLabel]) {
      setVideoURI(existingData.data[task.dataLabel]);
      setIsReviewing(true);
    }
  }, [existingData]);

  const toggleCameraFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60, mute: true  });
      setVideoURI(video.uri);
      setIsReviewing(true);
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }
  };

  const saveVideo = () => {
    onComplete({ [task.dataLabel]: videoURI });
  };

  const discardVideo = () => {
    setVideoURI(null);
    setIsReviewing(false);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to use the camera and microphone</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Grant Permission</Text>
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
            source={{ uri: videoURI }}
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
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          videoStabilizationMode="auto"
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={58} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={styles.captureButton}
            />
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
    backgroundColor: '#F2F2F2',
    borderRadius: 50,
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: 'white',
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
