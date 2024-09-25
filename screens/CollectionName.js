import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import SurveyCollection from '../utils/SurveyCollection';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';


const CollectionName = ({ route, navigation }) => {

    // Initialize the survey design context
    const { surveyDesign, addCollection, addNestedCollectionByID, findCollectionByID } = useSurveyDesign();

    const [collectionName, setCollectionName] = useState('');

    const parentID = route.params && route.params.parentID ? route.params.parentID : null;
    const parentName = route.params && route.params.parentName ? route.params.parentName : null;

    const validateFields = () => {
      const newErrors = {};
      if (!collectionName) newErrors.collectionName = 'Collection Name cannot be empty';
      return newErrors;
    };

    const handleDone = () => {

      const validationErrors = validateFields();
      if (Object.keys(validationErrors).length > 0) {
          Alert.alert(
              "Please fix the following errors:",
              Object.values(validationErrors).join('\n')
          );
          return;
      }

      let newCollection = new SurveyCollection({
        name: collectionName,
        parentId: parentID,
        parentName: parentName
      });

      console.log("New Collection:")
      console.log(newCollection)

      // TODO: Combine these methods into one
      if (parentID) {
        addNestedCollectionByID(parentID, newCollection)
      } else {
        addCollection(newCollection)
      }
      
      navigation.replace("CollectionDesignList", { collectionID: newCollection.ID })

    };
  
    return (
      <View style={styles.container}>
        <View style={styles.inputLabelContainer}>
            <Text style={styles.inputLabel}>Collection Name:</Text>
        </View>
        <TextInput
          style={styles.textInput}
          onChangeText={text => setCollectionName(text)}
          value={collectionName}
          placeholder="Enter item name"
          autoCorrect={false}
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
  
  export default CollectionName;