import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';
import { useRealm } from '@realm/react'; 

import styles from '../Styles';

const SurveyList = ({ navigation }) => {

  const { surveyDesign, clearSurveyDesign, setSurveyDesign, surveyFromMongo } = useSurveyDesign()
  const { newSurvey, loadFromStash, setSurveyData, surveyData, deleteFromStash, quickLoadSurvey } = useSurveyData()

  const realm = useRealm();

  // retrieve the set of objects and sort them alphabetically
  const designsList = realm.objects("SurveyDesign").sorted("name");

  const handleLoadSurvey = async (mongoDesign, designName) => {
    
    // Clear the current survey layout in the surveyDesignContext
    console.log('Clearing survey design...');
    clearSurveyDesign();


    console.log("First item in first collection: ")
    console.log(mongoDesign.collections[0].items[0])

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
              deleteFromStash(designName);
              newSurvey(mongoDesign);
              navigation.navigate('CollectionList');
            },
            style: "cancel"
          },
          {
            text: "Load",
            onPress: async () => {
              // Load the existing data
              console.log('Loading existing survey data...');
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
      console.log(surveyDesign)

      // surveyFromMongo(mongoDesign) still doesn't consistently wait for surveyDesign to be set
      // TODO: Find some way to simplyfy this process so there isn't all this duplication.
      // don't forget to fix the call in the discard option above.
      newSurvey(mongoDesign)
      navigation.navigate('CollectionList');
    }

  };

  return (
    <View style={styles.container}>
      <ScrollView>
        { designsList.length === 0 ? (
          <Text style={styles.emptyListText}>No Surveys Found</Text>
        ) : (
          designsList.map((design, index) => (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => handleLoadSurvey(design, design.name)}
            >
              <Text style={styles.text}>{design.name}</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
};

export default SurveyList;