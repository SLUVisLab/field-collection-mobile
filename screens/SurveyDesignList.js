import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSurveyDesign } from '../contexts/SurveyDesignContext'
import styles from '../Styles';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRealm } from '@realm/react'; 
import { tr } from 'date-fns/locale';

// TODO: Clean up after XLSX to mongo refactor

const SurveyDesignList = ({ navigation }) => {

  const { clearSurveyDesign, surveyFromMongo } = useSurveyDesign()

  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = () => setIsEditMode(!isEditMode);

  const realm = useRealm();

  // retrieve the set of  objects
  const designs = realm.objects("SurveyDesign");

  // Function to exit edit mode
  const exitEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false);
    }
  };

  const handleLoadSurvey = async (design) => {
    
    try {
      clearSurveyDesign();

      console.log('Load survey:', design);

      surveyFromMongo(design)
      // const surveyDesignFromFile = await convertXLSXToSurvey(filePath);
      // setSurveyDesign(surveyDesignFromFile);
      
      navigation.navigate('SurveyBuilder');
    } catch (error) {
      console.error('Error loading survey:', error);
    }
  };

  const handleDeleteSurvey = (deletableSurvey) => {
    console.log('Delete survey:', deletableSurvey);
    Alert.alert(
      'Delete Survey',
      'Are you sure you want to delete this survey?',
      [
        {
          text: 'Cancel',
          onPress: () => console.log('Cancel Pressed'),
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => {
            try {
              realm.write(() => {
                realm.delete(deletableSurvey);
              });

              exitEditMode();
            } catch (error) {
              console.error('Error deleting survey file:', error);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }

  return (
    <View style={styles.container}>
      
      <TouchableOpacity
        style={localStyles.addButton}
        onPress={() => !isEditMode && navigation.navigate('NewSurvey')}
      >
        <Ionicons name="add-circle-outline" size={24} color="black" />
        <Text style = {localStyles.addText}>New Survey</Text>
      </TouchableOpacity>

      {designs.map((design, index) => {
        // Extract file name without extension
        // let surveyName = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.xlsx', '');

        // surveyName = surveyName.replace(/_/g, ' ')

        return (
          <TouchableOpacity
            key={index}
            style={[styles.button, localStyles.surveyButton, isEditMode && localStyles.editMode]}
            onPress={() => !isEditMode && handleLoadSurvey(design)}
            onLongPress={toggleEditMode}
          >
            <View style={localStyles.buttonContentContainer}>
              <Text style={[{ flex: 1 }, styles.text]}>{design.name}</Text>
              {isEditMode && (
                <TouchableOpacity
                  style={[localStyles.deleteButton, { marginLeft: 'auto' }]} // Adjust positioning as needed
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                    handleDeleteSurvey(design);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="red" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const localStyles = StyleSheet.create({
  buttonContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  surveyButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editMode: {
    borderWidth: 1, // Adds a border to the button
    borderColor: 'rgba(0,0,0,0.2)', // Darkly shaded border color
    shadowColor: '#000', // Shadow color for iOS
    shadowOffset: { width: 0, height: 2 }, // Shadow position for iOS
    shadowOpacity: 0.25, // Shadow opacity for iOS
    shadowRadius: 3.84, // Shadow blur radius for iOS
    elevation: 5, // Elevation for Android to create shadow
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    textAlign: 'left',
    paddingVertical: 12,
    marginVertical: 34,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 3,
    elevation: 3,
    backgroundColor: 'white',
  },
  addText: {
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 4,
  },

});

export default SurveyDesignList;