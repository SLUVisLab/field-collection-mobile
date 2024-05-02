import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Modal } from 'react-native';
import { RNCamera } from 'react-native-camera';
import * as FileSystem from 'expo-file-system';
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';

import { TouchableOpacity } from 'react-native-gesture-handler';



const PhotoAction = ({ navigation, onComplete, task, item, collection }) => {

  useEffect(() => {
    const requestCameraPermission = async () => {
      const platformCameraPermission = Platform.select({
        android: PERMISSIONS.ANDROID.CAMERA,
        ios: PERMISSIONS.IOS.CAMERA,
      });

      try {
        const result = await check(platformCameraPermission);

        if (result === RESULTS.DENIED) {
          const requestResult = await request(platformCameraPermission);

          if (requestResult === RESULTS.GRANTED) {
            console.log('You can use the camera');
          } else {
            console.log('Permission denied');
          }
        } else if (result === RESULTS.GRANTED) {
          console.log('You can use the camera');
        }
      } catch (error) {
        console.log('Permission check error:', error);
      }
    };

    requestCameraPermission();
  }, []);

  const [showInstructions, setShowInstructions] = useState(false);

  const takePicture = async (camera, item, collection) => {
    console.log("take picture...")
    const options = { quality: 0.5, base64: true };
    const data = await camera.takePictureAsync(options);
  
    // Sanitize names by replacing spaces with underscores
    const itemName = item.name.replace(/ /g, '_');
    const collectionName = collection.name.replace(/ /g, '_');
  
    // Define the directory
    const dir = `${FileSystem.documentDirectory}images/`;
  
    // Create the directory if it doesn't exist
    if (!(await FileSystem.getInfoAsync(dir)).exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  
    // Define the path
    const path = `${dir}${itemName}_${collectionName}_${new Date().toISOString()}.jpg`;
  
    // Write the data to filesystem
    FileSystem.writeAsStringAsync(path, data.base64, { encoding: FileSystem.EncodingType.Base64 })
    .then(() => {
      console.log('Image saved to', path);
      onComplete();
    })
      .catch((error) => console.log('Save image error:', error));
  };

  const fakePicture = async (item, collection) => {
    console.log("fake picture...")
    console.log(item)
    console.log(collection)
  
    onComplete({ [task.dataLabel]: "sample/path/to/image/data"})
  };

  return (
    <View style={styles.cameraContainer}>

      <View style={styles.info}>
        <Text style={styles.text}>{item.name}</Text>
        <Text style={styles.text}>{collection.name}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <View style={styles.emptyView}></View>
        <TouchableOpacity style={styles.capture} onPress={() => fakePicture(item, collection)}>
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

      {/* <RNCamera
        style={styles.preview}
        type={RNCamera.Constants.Type.back}
        captureAudio={false}
      >
        {({ camera, status }) => {
          if (status !== 'READY') return <View style={styles.loading} />;
          return (
            <View style={styles.overlay}>
              <View style={styles.info}>
                <Text style={styles.text}>{item.name}</Text>
                <Text style={styles.text}>{collection.name}</Text>
              </View>
              <View style={styles.buttonContainer}>
                <View style={styles.emptyView}></View>
                <TouchableOpacity style={styles.capture} onPress={() => fakePicture(item, collection)}>
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
            </View>
          );
        }}
      </RNCamera> */}
    </View>
  );
  };

  const styles = StyleSheet.create({
    cameraContainer: {
      flex: 1,
      backgroundColor: 'black',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyView: { //this helps to center the red capture button for some reason?
      width: '20%'
    },
    text: {
      color: 'white',
    },
    info: {
      position: 'absolute',
      top: 10,
      left: 10
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'absolute',
      bottom: 30,
      width: '100%',
    },
    capture: {
      
      borderWidth: 2,
      borderColor: 'white',
      backgroundColor: 'red',
      borderRadius: 50,
      height: 100,
      width: 100,
      alignSelf: 'center'
    },
    helpButton: {
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
    textStyle: {
      color: "white",
      fontWeight: "bold",
      textAlign: "center"
    },
    modalText: {
      marginBottom: 15,
      textAlign: "center"
    }

});
  
  export default PhotoAction;