import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import styles from '../Styles';


const SurveyName = ({ navigation }) => {
  
  const [surveyName, setSurveyName] = useState('');

  const { surveyDesign, setName, clearSurveyDesign } = useSurveyDesign();

  const handleDone = () => {

    clearSurveyDesign();

    setName(surveyName);

    console.log('Survey Name:', surveyName);
    
    navigation.navigate("SurveyBuilder")
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputLabelContainer}>
        <Text style={styles.inputLabel}>Survey Name:</Text>
      </View>
      <TextInput
        style={styles.textInput}
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