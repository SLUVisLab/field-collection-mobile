import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../../Styles';



const PhotoAction = ({ navigation, onComplete, itemName }) => {

    console.log("LOADED PHOTO TASK")

    useEffect(() => {
        navigation.setOptions({ title: 'Photo' });
    }, []);

    const handleDone = () => {
        console.log("CALLING ON COMPLETE")
        onComplete();
      };

    return (
      <View>
        <Text>{itemName}</Text>
        <TouchableOpacity
            style={styles.button}
            onPress={handleDone}
            >
            <Text style={styles.text}>Done</Text>
        </TouchableOpacity>

      </View>
    );
  };
  
  export default PhotoAction;