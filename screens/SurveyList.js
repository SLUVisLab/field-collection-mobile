import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useFileContext } from '../contexts/FileContext';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';
import styles from '../Styles';

const SurveyList = ({ navigation }) => {
  const { surveyFiles, convertXLSXToSurvey } = useFileContext(); // Access surveyFiles from FileContext

  const { surveyDesign, clearSurveyDesign, setSurveyDesign } = useSurveyDesign()
  const { newSurvey, loadFromStash, setSurveyData, surveyData, deleteFromStash } = useSurveyData()

  const handleLoadSurvey = async (filePath) => {
    
    // Clear the current survey layout in the surveyDesignContext
    clearSurveyDesign();

    // Load a survey layout from xlsx file
    const surveyDesignFromFile = await convertXLSXToSurvey(filePath);

    // set the surveyDesign context -- it's used to navigate through the survey layout
    setSurveyDesign(surveyDesignFromFile);

    // Check for existing or unfinished survey data
    const existingSurveyData = await loadFromStash(surveyDesignFromFile.name); // use the value that is already loaded (surveyDesignFromFile)

    if (existingSurveyData) {
      console.log(existingSurveyData)
      Alert.alert(
        "Existing Survey Data Found",
        "Do you want to load the existing survey data or discard it?",
        [
          {
            text: "Discard",
            onPress: () => {
              // Discard the existing data and start a new survey
              deleteFromStash(surveyDesignFromFile.name)
              newSurvey(surveyDesign);
              navigation.navigate('CollectionList');
            },
            style: "cancel"
          },
          {
            text: "Load",
            onPress: () => {
              // Load the existing data
              setSurveyData(existingSurveyData);
              navigation.navigate('CollectionList');
            }
          }
        ]
      );
    } else {

      // Create a new surveyData instance with data from the surveyDesign
      //TODO -- These two things must always match, and do not have a method of enforcement. FIX

      newSurvey(surveyDesignFromFile)
      navigation.navigate('CollectionList');
    }

  };

  return (
    <View style={styles.container}>
      {surveyFiles.length === 0 ? (
        <Text>No Surveys Found</Text>
      ) : (
        surveyFiles.map((filePath, index) => {
          // Extract file name without extension
          let surveyName = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.xlsx', '');
          surveyName = surveyName.replace(/_/g, ' ');
  
          return (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => handleLoadSurvey(filePath)}
            >
              <Text style={styles.text}>{surveyName}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

export default SurveyList;