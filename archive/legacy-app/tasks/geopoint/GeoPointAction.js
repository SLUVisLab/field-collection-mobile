import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import styles from '../../Styles'; // Your shared styles
import crashlytics from '@react-native-firebase/crashlytics';

const GeoPointAction = ({ existingData, onComplete, task, item, collection }) => {
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [markerCoordinates, setMarkerCoordinates] = useState(null);
  const [recordedLocation, setRecordedLocation] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const mapRef = useRef(null);
  
  // Initial setup - get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          crashlytics().setAttributes({
            errorType: 'location_permission_denied',
            screen: 'GeoPointAction'
          });
          crashlytics().log('Location permissions not granted');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const initialRegion = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        
        setCurrentUserLocation(loc.coords);
        setMapRegion(initialRegion);
        setMarkerCoordinates(loc.coords);
      } catch (error) {
        crashlytics().setAttributes({
          errorType: 'location_initialization_error',
          screen: 'GeoPointAction'
        });
        crashlytics().log(`Error initializing location: ${error.message}`);
        crashlytics().recordError(error);
      }
    })();
  }, []);

  // Load existing data if available
  useEffect(() => {
    if (
      task &&
      task.dataLabel &&
      existingData &&
      existingData["data"] &&
      existingData["data"][task.dataLabel]
    ) {
      const savedLocation = existingData["data"][task.dataLabel];
      setRecordedLocation(savedLocation);
      
      // If we have saved coordinates but no current location yet, center on saved location
      if (savedLocation && !mapRegion) {
        setMapRegion({
          latitude: savedLocation.latitude,
          longitude: savedLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        setMarkerCoordinates({
          latitude: savedLocation.latitude,
          longitude: savedLocation.longitude,
        });
      }
    }
  }, [task, existingData]);

  // Handle region change when map is moved
  const handleRegionChange = (region) => {
    setMarkerCoordinates({
      latitude: region.latitude,
      longitude: region.longitude
    });
  };

  // Recenter map on user's location
  const recenterMap = async () => {
    try {
      // Get fresh location
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const loc = await Location.getCurrentPositionAsync({});
      setCurrentUserLocation(loc.coords);
      
      // Animate map to user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      }
    } catch (error) {
      crashlytics().setAttributes({
        errorType: 'recenter_location_error',
        screen: 'GeoPointAction'
      });
      crashlytics().log(`Error recentering map: ${error.message}`);
      crashlytics().recordError(error);
    }
  };

  // Record current marker position
  const handleRecord = () => {
    if (markerCoordinates) {
      setRecordedLocation(markerCoordinates);
    }
  };

  // Save recorded location
  const handleSave = () => {
    if (recordedLocation) {
      onComplete({ [task.dataLabel]: recordedLocation });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Map with fixed center marker */}
      <View style={{ flex: 2, position: 'relative' }}>
        {mapRegion && (
          <>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              showsUserLocation
              onError={(error) => {
                console.error("MapView error:", error);
                crashlytics().log(`MapView error: ${error}`);
              }}
              onMapReady={() => console.log("Map is ready")}
              initialRegion={mapRegion}
              onRegionChangeComplete={handleRegionChange}
            />

            {/* Fixed center marker */}
            <View style={localStyles.centerMarkerContainer}>
                <MaterialCommunityIcons 
                  name="map-marker" 
                  size={40} 
                  color="#E74C3C" // Red marker color
                  style={localStyles.centerMarker} 
                />
            </View>

            {/* Recenter button */}
            <TouchableOpacity 
              style={localStyles.recenterButton} 
              onPress={recenterMap}
            >
              <MaterialIcons name="my-location" size={24} color="black" />
            </TouchableOpacity>

            <View style={localStyles.infoOverlay}>
              {collection.parentName && <Text style={localStyles.infoText}>{collection.parentName}</Text>}
              <Text style={localStyles.infoText}>{collection.name}</Text>
              <Text style={localStyles.infoText}>{item.name}</Text>
            </View>
          </>
        )}
      </View>

      {/* Live marker location display */}
      {markerCoordinates && (
        <Text style={localStyles.coords}>
          Marker: {markerCoordinates.latitude.toFixed(5)}, {markerCoordinates.longitude.toFixed(5)}
        </Text>
      )}

      {/* Bottom: saved location + actions */}
      <View style={localStyles.bottomPanel}>
        <Text style={localStyles.recorded}>
          {recordedLocation
            ? `Recorded: ${recordedLocation.latitude.toFixed(5)}, ${recordedLocation.longitude.toFixed(5)}`
            : 'No location recorded yet.'}
        </Text>
        <View style={localStyles.buttonRow}>
          <TouchableOpacity style={localStyles.button} onPress={handleRecord}>
            <Text style={localStyles.buttonText}>Record Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={localStyles.button} onPress={handleSave}>
            <Text style={localStyles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Instructions Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showInstructions}
        onRequestClose={() => setShowInstructions(false)}
      >
        <View style={localStyles.centeredView}>
          <View style={localStyles.modalView}>
            <Text style={localStyles.modalText}>{task.instructions}</Text>
            <TouchableOpacity
              style={localStyles.helpButton}
              onPress={() => setShowInstructions(false)}
            >
              <Text style={localStyles.buttonText}>Hide Instructions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  infoOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 6,
  },
  infoText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  coords: {
    textAlign: 'center',
    marginTop: 5,
    fontWeight: '600',
  },
  bottomPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recorded: {
    fontSize: 16,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  button: {
    margin: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
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
  helpButton: {
    backgroundColor: "#2196F3",
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  // New styles for marker and recenter button
  centerMarkerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  centerMarker: {
    marginBottom: 30, // Adjust based on the icon size to make the tip the actual location
  },
  recenterButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});

export default GeoPointAction;