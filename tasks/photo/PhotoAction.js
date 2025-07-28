import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, Button, SafeAreaView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const PhotoAction = ({ existingData, onComplete, task, item, collection }) => {

  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(false);
  const [photo, setPhoto] = useState();
  const [photoURI, setPhotoURI] = useState();
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    if (isCameraReady) {
      console.log('Camera is ready. Perform an action here.');
    }
  }, [isCameraReady]);

  // let camera_instance;
  const cameraRef = useRef(null);

  const retrieveImage = async (uri) => {
    const resolvedPath = `${FileSystem.cacheDirectory}${uri}`;
    const imageBase64 = await FileSystem.readAsStringAsync(resolvedPath, { encoding: FileSystem.EncodingType.Base64 });
    return imageBase64;
  };

  useEffect(() => {
    if(task && task.dataLabel && existingData && existingData["data"] && existingData["data"][task.dataLabel]) {
      console.log("existing photo task data found")
      
      const fetchImage = async () => {
        try {
          const img = await retrieveImage(existingData["data"][task.dataLabel]);
          setPhotoURI(existingData["data"][task.dataLabel])
          setPhoto(img);
        } catch (error) {
          console.log("Retrieve image failed: ", error)
        }
    };

    fetchImage();
    }
  }, [task, existingData]);

  const takePicture = async () => {
    console.log("Button pressed!")
    if (cameraRef.current) {
      console.log("camera instance found!")
      const options = { quality: 0.6, base64: true };
      const data = await cameraRef.current.takePictureAsync(options);
      setPhoto(data.base64);
      const relativePath = data.uri.replace(FileSystem.cacheDirectory, '');
      setPhotoURI(relativePath)
      console.log(relativePath);
    } else {
      console.log("camera instance not found!")
    }
  };

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  if(photo) {
    let savePhoto = () => {
      onComplete({ [task.dataLabel]: photoURI });
      setPhoto(undefined);
      setPhotoURI(undefined);
    };

    let discardPhoto = () => {
      setPhoto(undefined)
      setPhotoURI(undefined)
    };

    return(
      <SafeAreaView style = {styles.container}>
        <Image style={styles.imagePreview} source = {{uri: "data:image/jpg;base64," + photo}} />
        <View style={styles.photoActionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={savePhoto}>
            <Text style={styles.actionButtonText}>Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={discardPhoto}>
            <Text style={styles.actionButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        {collection.parentName && <Text style={styles.infoText}>{collection.parentName}</Text>}
        <Text style={styles.infoText}>{collection.name}</Text>
        <Text style={styles.infoText}>{item.name}</Text>
      </View>
      <CameraView 
        ref={cameraRef}
        style={styles.camera} 
        facing={facing}
        autofocus={true}
        onCameraReady={() => setIsCameraReady(true)}  
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={58} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={() => takePicture()}>
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpButton} onPress={() => setShowInstructions(true)}>
            <Text style={styles.buttonText}>?</Text>
          </TouchableOpacity>
        </View>
        
        <Modal
          animationType="slide"
          transparent={true}
          visible={showInstructions}
          onRequestClose={() => {
            setShowInstructions(false);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalText}>{task.instructions}</Text>

              <TouchableOpacity
                style={{ ...styles.openButton, backgroundColor: "#2196F3" }}
                onPress={() => {
                  setShowInstructions(false);
                }}
              >
                <Text style={styles.textStyle}>Hide Instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </CameraView>
    </View>
  );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
    },
    imagePreview: {
      alignSelf: 'stretch',
      flex: 1,

    },
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
    camera: {
      flex: 1,
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      width: '100%',
      padding: 10,
    },
    flipButton: {
      justifyContent: 'center',
      alignItems: 'center',
      // marginTop: 20
    },
    infoText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 22,
    },
    info: {
      position: 'absolute',
      top: 20,
      left: 10,
      width: 500,
      zIndex: 1,
    },
    helpButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
      paddingHorizontal: 20,
      // paddingVertical: 10,
      borderRadius: 5,
      margin: 5,
      height: 50,
      width: 50,
      // marginTop: 50
    },
    buttonText: {
      color: 'black',
    },
    instructions: {
      color: 'white',
    },
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 22
    },
    modalView: {
      margin: 20,
      backgroundColor: "white",
      borderRadius: 20,
      padding: 35,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    openButton: {
      backgroundColor: "#F194FF",
      borderRadius: 20,
      padding: 10,
      elevation: 2
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
  
  export default PhotoAction;