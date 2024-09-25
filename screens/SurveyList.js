import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';
import { useRealm } from '@realm/react'; 

import styles from '../Styles';

const SurveyList = ({ navigation }) => {

  const { surveyDesign, clearSurveyDesign, setSurveyDesign, surveyFromMongo } = useSurveyDesign()
  const { newSurvey, loadFromStash, setSurveyData, surveyData, deleteFromStash } = useSurveyData()

  const realm = useRealm();

  // retrieve the set of  objects
  const designsList = realm.objects("SurveyDesign");

  const handleLoadSurvey = async (mongoDesign, designName) => {
    
    // Clear the current survey layout in the surveyDesignContext
    console.log('Clearing survey design...');
    clearSurveyDesign();

    await surveyFromMongo(mongoDesign);

    // Check for existing or unfinished survey data
    // IF YOU TRY TO USE THE SURVEY DESIGN OBJECT HERE, IT WILL BE EMPTY!!
    const existingSurveyData = await loadFromStash(designName); // use the value that is already loaded earlier.

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
              deleteFromStash(surveyDesign.name)
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
      console.log('No existing survey data found...');
      // Create a new surveyData instance with data from the surveyDesign
      //TODO -- These two things must always match, and do not have a method of enforcement. FIX

      newSurvey(surveyDesign)
      navigation.navigate('CollectionList');
    }

  };

  return (
    <View style={styles.container}>
      { designsList.length === 0 ? (
        <Text>No Surveys Found</Text>
      ) : (
        designsList.map((design, index) => {
          // Extract file name without extension
          // let surveyName = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.xlsx', '');
          // surveyName = surveyName.replace(/_/g, ' ');
  
          return (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => handleLoadSurvey(design, design.name)}
            >
              <Text style={styles.text}>{design.name}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

export default SurveyList;