import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, TextInput, SafeAreaView, Vibration, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const BarcodeAction = ({ navigation, existingData, onComplete, task, item, collection }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [lastScanned, setLastScanned] = useState(0);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef(null);

  useEffect(() => {
    if (existingData?.data?.[task.dataLabel]) {
      setScannedData(existingData.data[task.dataLabel]);
    }
  }, [existingData]);

  const toggleCameraFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const triggerFlash = () => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleBarCodeScanned = ({ data }) => {
    const now = Date.now();
    if (now - lastScanned > 2000 && data !== scannedData) {
      Vibration.vibrate(100);
      setScannedData(data);
      setLastScanned(now);
      triggerFlash();
    }
  };

  const handleSave = () => {
    onComplete({ [task.dataLabel]: scannedData || null });
  };

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need permission to use the camera</Text>
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

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'ean13', 'code39', 'code93', 'upc_e', 'pdf417', 'datamatrix', 'itf14', 'aztec', 'codabar', 'upc_a', 'ean8']
        }}
        onBarcodeScanned={handleBarCodeScanned}
      >
        <Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} />
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={58} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpButton} onPress={() => setShowInstructions(true)}>
            <Text style={styles.buttonText}>?</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      <View style={styles.resultContainer}>
        <TextInput
          style={styles.resultText}
          value={scannedData}
          editable={false}
          placeholder="Scanned barcode will appear here"
        />
        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <Text style={styles.actionButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showInstructions} transparent animationType="slide">
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{task.instructions}</Text>
            <TouchableOpacity style={{ ...styles.openButton, backgroundColor: '#2196F3' }} onPress={() => setShowInstructions(false)}>
              <Text style={styles.textStyle}>Hide Instructions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1
    },
    camera: {
      flex: 1
    },
    info: {
      position: 'absolute',
      top: 20,
      left: 10,
      width: 500,
      zIndex: 1
    },
    infoText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 22
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      width: '100%',
      padding: 10
    },
    flipButton: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    helpButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
      paddingHorizontal: 20,
      borderRadius: 5,
      margin: 5,
      height: 50,
      width: 50
    },
    buttonText: {
      color: 'black'
    },
    resultContainer: {
      padding: 16,
      backgroundColor: '#fff'
    },
    resultText: {
      backgroundColor: '#eee',
      padding: 12,
      borderRadius: 8,
      fontSize: 16,
      marginBottom: 12,
      color: '#333'
    },
    actionButton: {
      backgroundColor: '#ffffffdd',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ccc'
    },
    actionButtonText: {
      fontSize: 18,
      color: '#333',
      fontWeight: 'bold'
    },
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22
    },
    modalView: {
      margin: 20,
      backgroundColor: 'white',
      borderRadius: 20,
      padding: 35,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    openButton: {
      backgroundColor: '#F194FF',
      borderRadius: 20,
      padding: 10,
      elevation: 2
    },
    textStyle: {
      color: 'white'
    },
    modalText: {
      fontSize: 16,
      marginBottom: 15
    },
    flashOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 255, 0, 0.3)',
        zIndex: 10,
    }
  });

export default BarcodeAction;