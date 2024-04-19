import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../../Styles';



const TextAction = ({ navigation, onComplete, itemName }) => {

    useEffect(() => {
        navigation.setOptions({ title: 'Text' });
    }, []);

    const handleDone = () => {

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
  
  export default TextAction;