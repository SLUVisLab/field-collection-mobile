import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import * as DocumentPicker from 'expo-document-picker';
import { useFileContext } from '../contexts/FileContext'; 
import { useRealm } from '@realm/react';
import styles from '../Styles';
import { is } from 'date-fns/locale';


const NewSurvey = ({ navigation }) => {

  const { convertXLSXToSurvey } = useFileContext();
  
  const [surveyName, setSurveyName] = useState('');

  const { surveyDesign, setName, clearSurveyDesign } = useSurveyDesign();

  const realm = useRealm();

  const validateFields = () => {
    const newErrors = {};
    if (!itemName) newErrors.surveyName = 'Survey Name cannot be empty';
    return newErrors;
  };

  const isSurveyNameUnique = (name) => {
    const existingSurvey = realm.objects('SurveyDesign').filtered(`name == "${name}"`);
    return existingSurvey.length === 0;
  }

  const handleDone = () => {

    const validationErrors = validateFields();
    if (Object.keys(validationErrors).length > 0) {
        Alert.alert(
            "Please fix the following errors:",
            Object.values(validationErrors).join('\n')
        );
        return;
    }

    if(!isSurveyNameUnique(surveyName)){
      Alert.alert(
        "Survey Name Already Exists",
        "Please choose a different name"
      );
      return;
    }

    clearSurveyDesign();
    //TODO: This should be reformatted to be passed as a navagation param
    setName(surveyName);

    console.log('Survey Name:', surveyName);
    
    navigation.navigate("SurveyBuilder")
  };

  const handleImportFromXLSX = async () => {
    try {
      console.log("Launching Document Picker");
      const res = await DocumentPicker.getDocumentAsync({
        // Limiting the file type to xlsx
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      console.log("Document Picker Result:");
      console.log(res);
      console.log("Document Picker Result URI:");
      console.log(res.uri);
      console.log("Document Picker Result Name:");
      console.log(res.name);
      console.log("Document Picker Filetype extension:");
      console.log(res.name.split('.').pop());

      const formattedName = res.name
        .replace(/_/g, ' ') // Replace all underscores with spaces
        .replace(/\.[^/.]+$/, ''); // Remove the file extension

      console.log(formattedName); // Output: "Flower Photos"

      if(!isSurveyNameUnique(formattedName)){
        console.log("Survey with the same name already exists: ", formattedName);
        Alert.alert(
          "Existing Survey Data Found",
          "Do you want to cancel or overwrite the existing data?",
          [
            {
              text: "Cancel",
              onPress: () => {
                // Do nothing
                return;
              },
              style: "cancel"
            },
            {
              text: "Overwrite (Dont click me!)",
              onPress: () => {
                // I'm not sure about this yet. Persisting SurveyDesign ID's
                // Is the thing I'm worried about
                return;
              }
            }
          ]
        );
      }

      convertXLSXToSurvey(res.uri)

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
      } else {
        throw err;
      }
    }
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