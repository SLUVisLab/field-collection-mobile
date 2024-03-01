import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';


const SurveyName = ({ navigation }) => {
  const [surveyName, setSurveyName] = useState('');

  const handleDone = () => {
    // You can perform actions here when the "Done" button is pressed
    console.log('Survey Name:', surveyName);
    
    navigation.navigate("SurveyBuilder", {
        name: String(surveyName)
      });
    // You can navigate to another screen or perform other actions as needed
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Survey Name</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setSurveyName(text)}
        value={surveyName}
        placeholder="Enter survey name"
      />
      <TouchableOpacity
            style={styles.button}
            onPress={handleDone}
            >
            <Text style={styles.text}>Done</Text>
        </TouchableOpacity>
    </View>
  );
};

export default SurveyName;