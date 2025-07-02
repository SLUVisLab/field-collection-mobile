import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Modal, 
  SafeAreaView,
  FlatList,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const Gallery = ({ photos, removePhoto }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [photoBase64Cache, setPhotoBase64Cache] = useState({});

  const screenWidth = Dimensions.get('window').width;
  const numColumns = 3;
  const imageSize = (screenWidth - 40) / numColumns; // 40 for padding

  useEffect(() => {
    // Load base64 for all photos
    photos.forEach((uri, index) => {
      if (!photoBase64Cache[index]) {
        loadPhotoBase64(uri, index);
      }
    });
  }, [photos]);

  const loadPhotoBase64 = async (uri, index) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      setPhotoBase64Cache(prev => ({
        ...prev,
        [index]: base64
      }));
    } catch (e) {
      console.error("Failed to load photo base64", e);
    }
  };

  const handlePhotoPress = (index) => {
    setSelectedPhotoIndex(index);
  };

  const handleDeletePhoto = () => {
    if (selectedPhotoIndex !== null) {
      Alert.alert(
        "Delete Photo",
        "Are you sure you want to delete this photo? This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removePhoto(selectedPhotoIndex);
              setSelectedPhotoIndex(null);
              
              // Clean up cache for deleted photo
              setPhotoBase64Cache(prev => {
                const newCache = { ...prev };
                delete newCache[selectedPhotoIndex];
                
                // Adjust cache keys for photos after the deleted one
                const adjustedCache = {};
                Object.keys(newCache).forEach(key => {
                  const numKey = parseInt(key);
                  if (numKey > selectedPhotoIndex) {
                    adjustedCache[numKey - 1] = newCache[key];
                  } else {
                    adjustedCache[key] = newCache[key];
                  }
                });
                
                return adjustedCache;
              });
            }
          }
        ]
      );
    }
  };

  const renderThumbnail = ({ item: uri, index }) => {
    const base64 = photoBase64Cache[index];
    
    return (
      <TouchableOpacity 
        style={[styles.thumbnail, { width: imageSize, height: imageSize }]}
        onPress={() => handlePhotoPress(index)}
      >
        {base64 ? (
          <Image 
            source={{ uri: `data:image/jpg;base64,${base64}` }}
            style={styles.thumbnailImage}
          />
        ) : (
          <View style={styles.loadingThumbnail} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={photos}
        renderItem={renderThumbnail}
        keyExtractor={(item, index) => index.toString()}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Full-size image modal */}
      <Modal
        visible={selectedPhotoIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhotoIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedPhotoIndex(null)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>

            {/* Delete button */}
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeletePhoto}
            >
              <Ionicons name="trash-bin" size={24} color="white" />
            </TouchableOpacity>

            {/* Full-size image */}
            {selectedPhotoIndex !== null && photoBase64Cache[selectedPhotoIndex] && (
              <Image 
                source={{ uri: `data:image/jpg;base64,${photoBase64Cache[selectedPhotoIndex]}` }}
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  grid: {
    padding: 10,
    alignItems: 'center',
  },
  thumbnail: {
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  loadingThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#555',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  deleteButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullSizeImage: {
    width: '90%',
    height: '80%',
  },
});

export default Gallery;
