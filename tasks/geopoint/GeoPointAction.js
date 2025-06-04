import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import styles from '../../Styles'; // Your shared styles

const GeoPointAction = ({ existingData, onComplete, task, item, collection }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [recordedLocation, setRecordedLocation] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setCurrentLocation(loc.coords);
    })();
  }, []);

  useEffect(() => {
    if (
      task &&
      task.dataLabel &&
      existingData &&
      existingData["data"] &&
      existingData["data"][task.dataLabel]
    ) {
      setRecordedLocation(existingData["data"][task.dataLabel]);
    }
  }, [task, existingData]);

  useEffect(() => {
    console.log("MapView props:", {
      provider: PROVIDER_GOOGLE,
      hasLocation: !!currentLocation,
    });
    
    // Add a simple network test
    fetch('https://www.google.com')
      .then(() => console.log('Network connection available'))
      .catch(e => console.error('Network test failed:', e));
      
    // Check if Google Maps JS API is accessible
    fetch('https://maps.googleapis.com')
      .then(() => console.log('Maps API reachable'))
      .catch(e => console.error('Maps API unreachable:', e));
  }, [currentLocation]);

  const handleRecord = () => {
    if (currentLocation) {
      setRecordedLocation(currentLocation);
    }
  };

  const handleSave = () => {
    if (recordedLocation) {
      onComplete({ [task.dataLabel]: recordedLocation });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Map with overlay */}
      <View style={{ flex: 2 }}>
        {currentLocation && (
          <>
            <MapView
              style={{ flex: 1 }}
              // provider={PROVIDER_GOOGLE}
              showsUserLocation
              onError={(error) => console.error("MapView error:", error)}
              onMapReady={() => console.log("Map is ready")}
              region={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker coordinate={currentLocation} />
            </MapView>

            <View style={localStyles.infoOverlay}>
              {collection.parentName && <Text style={localStyles.infoText}>{collection.parentName}</Text>}
              <Text style={localStyles.infoText}>{collection.name}</Text>
              <Text style={localStyles.infoText}>{item.name}</Text>
            </View>
          </>
        )}
      </View>

      {/* Live location display */}
      {currentLocation && (
        <Text style={localStyles.coords}>
          Live: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
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
});

export default GeoPointAction;