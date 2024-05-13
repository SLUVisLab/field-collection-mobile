import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, Button, SafeAreaView, Image } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
// import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';

// import { TouchableOpacity } from 'react-native-gesture-handler';



const PhotoAction = ({ navigation, existingData, onComplete, task, item, collection }) => {

  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(false);
  const [photo, setPhoto] = useState();
  const [photoURI, setPhotoURI] = useState();

  // let camera_instance;
  const cameraRef = useRef(null);

  const retrieveImage = async (uri) => {
    const imageBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return imageBase64;
  };

  useEffect(() => {
    if(task && task.dataLabel && existingData[task.dataLabel]) {
      console.log("existing photo task data found")
      
      const fetchImage = async () => {
        const img = await retrieveImage(existingData[task.dataLabel]);
        setPhotoURI(existingData[task.dataLabel])
        setPhoto(img);
    };

    fetchImage();
    }
  }, [task, existingData]);

  const takePicture = async () => {
    console.log("Button pressed!")
    if (cameraRef.current) {
      console.log("camera instance found!")
      const options = { quality: 0.5, base64: true };
      const data = await cameraRef.current.takePictureAsync(options);
      setPhoto(data.base64);
      setPhotoURI(data.uri)
      console.log(data.uri);
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
        <Button title='save' onPress={savePhoto} />
        <Button title='discard' onPress={discardPhoto} />
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <Camera 
        ref={cameraRef}
        style={styles.camera} 
        type={facing === 'back' ? Camera.Constants.Type.back : Camera.Constants.Type.front}  
      >
        <View style={styles.info}>
          <Text style={styles.text}>{collection.name}</Text>
          <Text style={styles.text}>{item.name}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Flip Camera</Text>
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
      </Camera>
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
      backgroundColor: 'red',
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
      width: '100%',
      padding: 10,
    },
    flipButton: {

      justifyContent: 'center',
    },
    text: {
      color: 'white',
    },
    info: {
      position: 'absolute',
      top: 10,
      left: 10
    },
    helpButton: {
      felx: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 5,
      margin: 10,
      marginTop: 50
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
  });
  
  export default PhotoAction;