import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, Button, SafeAreaView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const MultiPhotoAction = ({ existingData, onComplete, task, item, collection }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewBase64, setPreviewBase64] = useState(undefined);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef(null);

  const photoCountOption = task?.options?.photoCount;
  const isAtCamera = currentIndex >= photos.length;

  useEffect(() => {
    if (existingData?.data?.[task.dataLabel]) {
      const existing = existingData.data[task.dataLabel];
      const arr = Array.isArray(existing) ? existing : [existing];
      setPhotos(arr);
    }
  }, [existingData]);

  useEffect(() => {
    if (!isAtCamera) {
      loadPreview(photos[currentIndex]);
    } else {
      setPreviewBase64(undefined);
    }
  }, [currentIndex, photos]);

  const loadPreview = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setPreviewBase64(base64);
    } catch (e) {
      console.error("Failed to load preview image", e);
    }
  };

  const takePicture = async () => {
    console.log("Taking photo...");
    console.log(cameraRef.current)
    if (!cameraRef.current) return;
    const data = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
  
    setPhotos(prevPhotos => {
      const updatedPhotos = [...prevPhotos, data.uri];
      setCurrentIndex(updatedPhotos.length - 1); // index of new photo
      return updatedPhotos;
    });
  };

  const discardPhoto = () => {
    const updated = photos.filter((_, i) => i !== currentIndex);
    setPhotos(updated);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const savePhoto = () => {
    setCurrentIndex((i) => Math.min(i + 1, photos.length));
  };

  const toggleCameraFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const canTakeMorePhotos = () => {
    if (!photoCountOption) return true;
    if (typeof photoCountOption === 'number') return photos.length < photoCountOption;
    const max = photoCountOption.max ?? Infinity;
    return photos.length < max;
  };

  const canFinish = () => {
    if (!photoCountOption) return photos.length > 0;
    if (typeof photoCountOption === 'number') return photos.length === photoCountOption;
    const min = photoCountOption.min ?? 0;
    return photos.length >= min;
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.info}>
        {collection.parentName && <Text style={styles.infoText}>{collection.parentName}</Text>}
        <Text style={styles.infoText}>{collection.name}</Text>
        <Text style={styles.infoText}>{item.name}</Text>
        <Text style={styles.infoText}>{`Photo ${currentIndex + 1} of ${photos.length}${canTakeMorePhotos() ? '' : ' (max reached)'}`}</Text>
      </View>

      {!isAtCamera ? (
        <View style={{ flex: 1 }}>
          <Image style={styles.imagePreview} source={{ uri: `data:image/jpg;base64,${previewBase64}` }} />
          <View style={styles.photoActionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={savePhoto}>
              <Text style={styles.actionButtonText}>Keep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={discardPhoto}>
              <Text style={styles.actionButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
          {currentIndex > 0 && (
            <TouchableOpacity style={styles.navLeft} onPress={() => setCurrentIndex(currentIndex - 1)}>
              <Ionicons name="chevron-back" size={48} color="white" style={styles.navIconShadow} />
            </TouchableOpacity>
          )}

          {currentIndex < photos.length - 1 && (
            <TouchableOpacity style={styles.navRight} onPress={() => setCurrentIndex(currentIndex + 1)}>
              <Ionicons name="chevron-forward" size={48} color="white" style={styles.navIconShadow} />
            </TouchableOpacity>
          )}
        </View>
      ) : canTakeMorePhotos() ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
              <Ionicons name="camera-reverse" size={58} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={takePicture} style={styles.captureButton} />
            <TouchableOpacity style={styles.helpButton} onPress={() => setShowInstructions(true)}>
              <Text style={styles.buttonText}>?</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.container}>
          <Text style={{ textAlign: 'center' }}>Maximum photo limit reached</Text>
          <Button title="Review Photos" onPress={() => setCurrentIndex(0)} />
        </View>
      )}

      {isAtCamera && canFinish() && (
        <Button
          title="Finish Photo Task"
          onPress={() => onComplete({ [task.dataLabel]: photos })}
        />
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
  imagePreview: { alignSelf: 'stretch', flex: 1 },
  captureButton: {
    backgroundColor: '#F2F2F2',
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
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
  flipButton: { justifyContent: 'center', alignItems: 'center' },
  infoText: { color: 'white', fontWeight: 'bold', fontSize: 22 },
  info: { position: 'absolute', top: 20, left: 10, width: 500, zIndex: 1 },
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
  instructions: { color: 'white' },
  centeredView: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 22 },
  modalView: {
    margin: 20, backgroundColor: "white", borderRadius: 20, padding: 35, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5
  },
  openButton: { backgroundColor: "#F194FF", borderRadius: 20, padding: 10, elevation: 2 },
  textStyle: { color: 'white' },
  modalText: { fontSize: 16, marginBottom: 15 },
  navLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: [{ translateY: -24 }],
    zIndex: 10,
    padding: 8,
  },
  
  navRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -24 }],
    zIndex: 10,
    padding: 8,
  },
  
  navIconShadow: {
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  photoActionButtons: {
    marginVertical: 10,
    paddingHorizontal: 20,
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
});

export default MultiPhotoAction;
