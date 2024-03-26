import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import SurveyCollection from '../utils/SurveyCollection';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';


const CollectionName = ({ route, navigation }) => {

    // Initialize the survey design context
    const { surveyDesign, addCollection, addNestedCollectionByID } = useSurveyDesign();

    const [collectionName, setCollectionName] = useState('');

    const parentID = route.params && route.params.parentID ? route.params.parentID : null;
    console.log(parentID)

    const handleDone = () => {

      let newCollection = new SurveyCollection(collectionName, parentID)

      // TODO: Combine these methods into one
      if (parentID) {
        addNestedCollectionByID(parentID, newCollection)
      } else {
        addCollection(newCollection)
      }
      
      navigation.navigate("Collection")

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