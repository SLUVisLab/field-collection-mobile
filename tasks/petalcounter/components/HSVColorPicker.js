import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import { generateColorMask } from '../lib/CountPetals';

const HSVColorPicker = ({ photoURI, onColorSelected, onClose }) => {
  const [colorParams, setColorParams] = useState({
    hueMin: 18,
    hueMax: 38,
    satMin: 60,
    satMax: 255,
    valMin: 60,
    valMax: 255,
  });
  
  const [previewImage, setPreviewImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  // Add debug logging
  useEffect(() => {
    console.log("HSVColorPicker received photoURI:", photoURI ? "Valid URI" : "No URI");
  }, [photoURI]);

  // Generate preview when parameters change
  const updatePreview = async () => {
    if (!photoURI) {
      console.log("No photo URI provided to HSVColorPicker");
      return;
    }
    
    try {
      console.log("Generating preview with URI:", photoURI.substring(0, 30) + "...");
      setIsGenerating(true);
      const previewData = await generateColorMask(photoURI, colorParams);
      
      if (previewData && previewData.preview) {
        console.log("Preview generated successfully, length:", previewData.preview.length);
        setPreviewImage(previewData.preview);
      } else {
        console.error("Preview generation failed: No preview data returned");
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Debounced update to avoid too many preview generations
  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    const timeout = setTimeout(() => {
      updatePreview();
    }, 300);
    
    setDebounceTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [colorParams, photoURI]);

  // Generate preview on initial load
  useEffect(() => {
    updatePreview();
  }, []);

  const handleSliderChange = (param, value) => {
    setColorParams(prev => ({
      ...prev,
      [param]: Math.round(value)
    }));
  };
  
  // Preset colors for common flower types
  const presets = [
    { name: 'Yellow', color: {hueMin: 18, hueMax: 38, satMin: 60, satMax: 255, valMin: 60, valMax: 255} },
    { name: 'White', color: {hueMin: 0, hueMax: 180, satMin: 0, satMax: 30, valMin: 200, valMax: 255} },
    { name: 'Pink', color: {hueMin: 140, hueMax: 170, satMin: 50, satMax: 255, valMin: 100, valMax: 255} },
    { name: 'Purple', color: {hueMin: 120, hueMax: 140, satMin: 50, satMax: 255, valMin: 50, valMax: 255} },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Flower Color</Text>
      
      {/* Preview area */}
      <View style={styles.previewContainer}>
        {isGenerating ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : previewImage ? (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${previewImage}` }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noPreviewContainer}>
            <Text style={styles.noPreviewText}>
              {photoURI ? "Generating preview..." : "No camera preview available"}
            </Text>
            <Text style={styles.noPreviewSubtext}>
              {photoURI ? "Please wait..." : "Color adjustments will apply when you take a photo"}
            </Text>
          </View>
        )}
      </View>
      
      {/* Color presets */}
      <View style={styles.presetsContainer}>
        <Text style={styles.sectionTitle}>Presets:</Text>
        <View style={styles.presetButtons}>
          {presets.map((preset, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.presetButton}
              onPress={() => setColorParams(preset.color)}
            >
              <Text style={styles.presetText}>{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* HSV Sliders */}
      <View style={styles.slidersContainer}>
        <Text style={styles.sectionTitle}>Fine Tune:</Text>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Hue Min:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={180}
            value={colorParams.hueMin}
            onValueChange={(v) => handleSliderChange('hueMin', v)}
            minimumTrackTintColor="#FF5722"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.hueMin}</Text>
        </View>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Hue Max:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={180}
            value={colorParams.hueMax}
            onValueChange={(v) => handleSliderChange('hueMax', v)}
            minimumTrackTintColor="#FF5722"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.hueMax}</Text>
        </View>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Sat Min:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={255}
            value={colorParams.satMin}
            onValueChange={(v) => handleSliderChange('satMin', v)}
            minimumTrackTintColor="#2196F3"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.satMin}</Text>
        </View>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Sat Max:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={255}
            value={colorParams.satMax}
            onValueChange={(v) => handleSliderChange('satMax', v)}
            minimumTrackTintColor="#2196F3"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.satMax}</Text>
        </View>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Val Min:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={255}
            value={colorParams.valMin}
            onValueChange={(v) => handleSliderChange('valMin', v)}
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.valMin}</Text>
        </View>
        
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Val Max:</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={255}
            value={colorParams.valMax}
            onValueChange={(v) => handleSliderChange('valMax', v)}
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#EEEEEE"
          />
          <Text style={styles.sliderValue}>{colorParams.valMax}</Text>
        </View>
      </View>
      
      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={onClose}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.applyButton]} 
          onPress={() => onColorSelected(colorParams)}
        >
          <Text style={styles.buttonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  previewContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  noPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPreviewText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
  },
  noPreviewSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  presetsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  presetButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  presetText: {
    fontSize: 14,
  },
  slidersContainer: {
    marginBottom: 20,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    width: 70,
    fontSize: 14,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 30,
    textAlign: 'right',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  }
});

export default HSVColorPicker;