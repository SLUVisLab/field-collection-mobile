import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity, Alert, Platform } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import * as DocumentPicker from 'expo-document-picker';
import { convertXLSXToSurvey } from '../utils/FileTools';
import { useRealm } from '@realm/react';
import styles from '../Styles';
import { is } from 'date-fns/locale';


const NewSurvey = ({ navigation }) => {
  
  const [surveyName, setSurveyName] = useState('');

  const { surveyDesign, setName, clearSurveyDesign, setSurveyDesign } = useSurveyDesign();

  const realm = useRealm();

  const validateFields = () => {
    const newErrors = {};
    if (!surveyName) newErrors.surveyName = 'Survey Name cannot be empty';
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

  const launchDocumentPicker = async () => { 
    return new Promise(async (resolve, reject) => {
      try {
        console.log("Launching Document Picker");
        const res = await DocumentPicker.getDocumentAsync({
          // Limiting the file type to xlsx
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          copyToCacheDirectory: true, // ensure file is accessible
          multiple: false
        });

        // Handle Android Google Drive crash-prone URIs
        const uri = res?.assets?.[0]?.uri ?? res?.uri;

        if (
          Platform.OS === 'android' &&
          uri?.startsWith('content://com.google.android.apps.docs.storage')
        ) {
          Alert.alert(
            "Unsupported File Source",
            "Please download the file from Google Drive to your device first, then try again."
          );
          resolve(null);
          return;
        }

        resolve(res);

      } catch (err) {
        if (DocumentPicker.isCancel(err)) {
          // User cancelled the picker
          resolve(null);
        } else {
          throw err;
        }
      }
    });
  };

  const handleImportFromXLSX = async () => {
    try {
      
      const res = await launchDocumentPicker();

      if (!res) {
        console.log("User cancelled document picker");
        return;
      }

      if (res.assets.length === 0) {
        console.log("No file returned from document picker");
        throw new Error("No file returned from document picker");
      }

      const document = res.assets?.[0] ?? res;

      console.log("Document Picker Result: ", document);
      console.log("name: ", document.name);

      const formattedName = document.name
        .replace(/_/g, ' ') // Replace all underscores with spaces
        .replace(/\.[^/.]+$/, ''); // Remove the file extension

      console.log(formattedName); // Output: "Flower Photos"

      if(!isSurveyNameUnique(formattedName)){
        console.log("Survey with the same name already exists: ", formattedName);
        Alert.alert(
          "Existing Survey Design Found",
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
              text: "Overwrite",
              onPress: async () => {
                // I'm not sure about this yet. Persisting SurveyDesign ID's
                // Is the thing I'm worried about
                let newSurvey = await convertXLSXToSurvey(document.uri, formattedName);
                setSurveyDesign(newSurvey);
                navigation.navigate("SurveyBuilder", { surveyIsImported: true });
              }
            }
          ]
        );
      } else {
        let newSurvey = await convertXLSXToSurvey(document.uri, formattedName);
        setSurveyDesign(newSurvey);
        navigation.navigate("SurveyBuilder", { surveyIsImported: true });
      }

    } catch (err) {
      console.error("Error importing from XLSX: ", err);
      Alert.alert(
        "Error importing from XLSX",
        "Please check the file and try again"
      );
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
      autoCorrect={false}
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