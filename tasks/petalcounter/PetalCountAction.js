import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, Button, SafeAreaView, Image, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { countPetals } from './lib/CountPetals';
import { Picker } from '@react-native-picker/picker';

const PetalCountAction = ({ existingData, onComplete, task, item, collection }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [showInstructions, setShowInstructions] = useState(false);
  const [photo, setPhoto] = useState();
  const [photoURI, setPhotoURI] = useState();
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // New state variables for petal counting
  const [isProcessing, setIsProcessing] = useState(false);
  const [petalData, setPetalData] = useState(null);
  const [error, setError] = useState(null);

  // Add new state for the selected mask
  const [selectedMask, setSelectedMask] = useState('result');

  const cameraRef = useRef(null);

  const retrieveImage = async (uri) => {
    const imageBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
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
    if (cameraRef.current) {
      try {
        const options = { quality: 0.8, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        setPhoto(data.base64);
        setPhotoURI(data.uri);
        
        // Process the image for petal counting
        setIsProcessing(true);
        setError(null);
        
        try {
          const results = await countPetals(data.uri);
          setPetalData(results);
        } catch (err) {
          console.error("Petal counting failed:", err);
          setError("Failed to analyze petals. Please try again with a clearer photo.");
        } finally {
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Failed to take picture:", err);
        setError("Failed to take picture. Please try again.");
      }
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

  if (photo) {
    let savePhoto = () => {
      // Save photo and petal count data if available
      const dataToSave = { 
        [task.dataLabel]: photoURI,
        [`${task.dataLabel}_petalCount`]: petalData?.count || 0
      };
      onComplete(dataToSave);
      setPhoto(undefined);
      setPhotoURI(undefined);
      setPetalData(null);
    };

    let discardPhoto = () => {
      setPhoto(undefined);
      setPhotoURI(undefined);
      setPetalData(null);
      setError(null);
    };

    // Show loading indicator while processing
    if (isProcessing) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Analyzing petals...</Text>
          </View>
        </SafeAreaView>
      );
    }

    // Show error if one occurred
    if (error) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={60} color="red" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={discardPhoto}>
              <Text style={styles.actionButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // Define mask options with descriptive labels
    const maskOptions = [
      { key: 'result', label: 'Final Result', description: 'The processed image with detected petals' },
      { key: 'rgbBlur', label: 'RGB Blur', description: 'Initial median blur applied to reduce noise' },
      { key: 'hsvMask', label: 'HSV Mask', description: 'Yellow color detection using HSV color space' },
      { key: 'bMask', label: 'B Channel Mask', description: 'Mask from the b channel of LAB color space' },
      { key: 'yellowMask', label: 'Yellow Mask', description: 'Combined HSV and b channel masks' },
      { key: 'openedMask', label: 'Opened Mask', description: 'After morphological opening operation' },
      { key: 'closedMask', label: 'Closed Mask', description: 'After morphological closing operation' },
      { key: 'largestMask', label: 'Largest Component', description: 'Largest connected component in the mask' },
      { key: 'filledMask', label: 'Filled Mask', description: 'Mask with holes filled' },
      { key: 'edtInputMask', label: 'EDT Input', description: 'Input for distance transform with center point' },
      { key: 'edtMask', label: 'EDT Output', description: 'Distance transform output' },
    ];
    
    // Get the current image source based on selected mask
    const getCurrentImageSource = () => {
      if (!petalData) return `data:image/jpg;base64,${photo}`;
      
      if (selectedMask === 'result') {
        return `data:image/png;base64,${petalData.image}`;
      } else if (petalData[selectedMask]) {
        return `data:image/jpeg;base64,${petalData[selectedMask]}`;
      }
      
      return `data:image/png;base64,${petalData.image}`;
    };

    // Determine if we should show overlays based on the selected mask
    const shouldShowOverlays = () => {
      return selectedMask === 'result';
    };

    return (
      <SafeAreaView style={styles.container}>
        {petalData ? (
          <>
            <View
              style={{
                width: '100%',
                aspectRatio: petalData.dimensions.width / petalData.dimensions.height,
                position: 'relative',
              }}
            >
              <Image 
                source={{ uri: getCurrentImageSource() }}
                style={{
                  width: '100%',
                  height: '100%',
                  resizeMode: 'contain',
                }}
              />

              {/* Only show overlays when viewing the result image */}
              {shouldShowOverlays() && (
                <>
                  {/* Overlay bounding box */}
                  {petalData.maskBounds && (
                    <View
                      style={{
                        position: 'absolute',
                        left: petalData.maskBounds.xMin,
                        top: petalData.maskBounds.yMin,
                        width: petalData.maskBounds.xMax - petalData.maskBounds.xMin,
                        height: petalData.maskBounds.yMax - petalData.maskBounds.yMin,
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 0, 0.6)',
                        borderStyle: 'dashed',
                      }}
                    />
                  )}

                  {/* Overlay center point */}
                  {petalData.center && (
                    <View
                      style={{
                        position: 'absolute',
                        left: petalData.center[0] - 6,
                        top: petalData.center[1] - 6,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: 'rgba(0, 128, 255, 0.7)',
                        borderWidth: 1,
                        borderColor: 'white',
                        zIndex: 10,
                      }}
                    />
                  )}

                  {/* Overlay threshold circle */}
                  {petalData.thresholdDist && petalData.center && (
                    <View
                      style={{
                        position: 'absolute',
                        width: petalData.thresholdDist * 2,
                        height: petalData.thresholdDist * 2,
                        borderRadius: petalData.thresholdDist,
                        left: petalData.center[0] - petalData.thresholdDist,
                        top: petalData.center[1] - petalData.thresholdDist,
                        borderWidth: 1,
                        borderColor: 'rgba(0, 128, 255, 0.7)',
                        borderStyle: 'dashed',
                      }}
                    />
                  )}

                  {/* Overlay birth points */}
                  {petalData.births?.map((point, index) => (
                    <View
                      key={`birth-${index}`}
                      style={{
                        position: 'absolute',
                        left: point[1],
                        top: point[0],
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: 'rgba(0, 255, 0, 0.7)',
                        borderWidth: 1,
                        borderColor: 'white',
                      }}
                    />
                  ))}

                  {/* Overlay death points */}
                  {petalData.deaths?.map((point, index) => (
                    <View
                      key={`death-${index}`}
                      style={{
                        position: 'absolute',
                        left: point[1],
                        top: point[0],
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: 'rgba(255, 0, 0, 0.7)',
                        borderWidth: 1,
                        borderColor: 'white',
                      }}
                    />
                  ))}
                </>
              )}

              {/* Petal count display */}
              <View style={styles.countContainer}>
                <Text style={styles.countLabel}>Petal Count</Text>
                <Text style={styles.countValue}>{petalData.count}</Text>
              </View>
            </View>

            {/* Processing stage selector */}
            <View style={styles.processingStageSelector}>
              <Text style={styles.processingStageSelectorLabel}>
                {maskOptions.find(o => o.key === selectedMask)?.label}
              </Text>
              
              {/* Description of the current processing stage */}
              <Text style={styles.processingStageSelectorDescription}>
                {maskOptions.find(o => o.key === selectedMask)?.description}
              </Text>
              
              {/* Navigation buttons for stages */}
              <View style={styles.stageNavigationButtons}>
                <TouchableOpacity
                  style={[styles.stageNavigationButton, selectedMask === maskOptions[0].key && styles.stageNavigationButtonDisabled]}
                  disabled={selectedMask === maskOptions[0].key}
                  onPress={() => {
                    const currentIndex = maskOptions.findIndex(o => o.key === selectedMask);
                    if (currentIndex > 0) {
                      setSelectedMask(maskOptions[currentIndex - 1].key);
                    }
                  }}
                >
                  <Text style={styles.stageNavigationButtonText}>Previous</Text>
                </TouchableOpacity>
                
                <Text style={styles.stageCounter}>
                  {maskOptions.findIndex(o => o.key === selectedMask) + 1} / {maskOptions.length}
                </Text>
                
                <TouchableOpacity
                  style={[styles.stageNavigationButton, selectedMask === maskOptions[maskOptions.length - 1].key && styles.stageNavigationButtonDisabled]}
                  disabled={selectedMask === maskOptions[maskOptions.length - 1].key}
                  onPress={() => {
                    const currentIndex = maskOptions.findIndex(o => o.key === selectedMask);
                    if (currentIndex < maskOptions.length - 1) {
                      setSelectedMask(maskOptions[currentIndex + 1].key);
                    }
                  }}
                >
                  <Text style={styles.stageNavigationButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <Image style={styles.imagePreview} source={{ uri: `data:image/jpg;base64,${photo}` }} />
        )}

        <View style={styles.photoActionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={savePhoto}>
            <Text style={styles.actionButtonText}>Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={discardPhoto}>
            <Text style={styles.actionButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

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
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
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
    borderRadius: 5,
    margin: 5,
    height: 50,
    width: 50,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginVertical: 20,
  },
  marker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'white',
  },
  analysisContainer: {
    flex: 1,
    position: 'relative',
  },
  countContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  countLabel: {
    color: 'white',
    fontSize: 14,
  },
  countValue: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 28,
  },
  centerDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 128, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'white',
    zIndex: 10,
  },
  thresholdCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0, 128, 255, 0.6)',
    borderStyle: 'dashed',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 0, 0.6)',
    borderStyle: 'dashed',
  },
  processingStageSelector: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    margin: 10,
  },
  processingStageSelectorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  processingStageSelectorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  stageNavigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageNavigationButton: {
    backgroundColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  stageNavigationButtonDisabled: {
    opacity: 0.5,
  },
  stageNavigationButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stageCounter: {
    fontSize: 14,
    color: '#666',
  }
});

export default PetalCountAction;