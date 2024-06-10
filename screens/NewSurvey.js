import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import styles from '../Styles';


const NewSurvey = ({ navigation }) => {
  
  const [surveyName, setSurveyName] = useState('');

  const { surveyDesign, setName, clearSurveyDesign } = useSurveyDesign();

  const handleDone = () => {

    clearSurveyDesign();

    setName(surveyName);

    console.log('Survey Name:', surveyName);
    
    navigation.navigate("SurveyBuilder")
  };

  const handleImportFromXLSX = async () => {
    // try {
    //   const res = await DocumentPicker.pick({
    //     type: [DocumentPicker.types.allFiles],
    //   });

    //   console.log(
    //     res.uri,
    //     res.type, // mime type
    //     res.name,
    //     res.size
    //   );
    // } catch (err) {
    //   if (DocumentPicker.isCancel(err)) {
    //     // User cancelled the picker
    //   } else {
    //     throw err;
    //   }
    // }
  };

  return (
<View style={[styles.container, { flex: 1, justifyContent: 'space-between' }]}>
  <View style={{ justifyContent: 'center', flex: 1 }}>
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
  <TouchableOpacity
    style={[styles.button, { marginBottom: 30 }]}
    onPress={handleImportFromXLSX}
  >
    <Text style={styles.text}>Import From XLSX File</Text>
  </TouchableOpacity>
</View>
  );
};

export default NewSurvey;