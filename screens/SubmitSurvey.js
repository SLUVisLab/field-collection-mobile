import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message'
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';

const SubmitSurvey = ({ route, navigation }) => {
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();
  const { itemHasObservation } = useSurveyData()

  // Recursive function to check items in collections and subcollections
  const checkItemsInCollection = (collection) => {
    let totalItems = 0;
    let itemsWithObservations = 0;
    let subCollections = [];

    if (collection.items.length > 0) {
      // Process items
      totalItems = collection.items.length;
      itemsWithObservations = collection.items.filter(item => itemHasObservation(item.ID)).length;
    } else {
      // Process subcollections
      subCollections = collection.subCollections.map(subCollection => checkItemsInCollection(subCollection));
    }

    return {
      name: collection.name,
      totalItems,
      itemsWithObservations,
      subCollections
    };
  };

  const handleSubmit = () => {
    Toast.show({
      type: 'success',
      position: 'bottom',
      text1: 'Survey Submitted Successfully',
      visibilityTime: 1000,
      autoHide: true,
      topOffset: 30,
      bottomOffset: 40,
    });

    navigation.navigate('Home')

  };

  // Start checking from the main collection
  let surveySummary = surveyDesign.collections.map(collection => checkItemsInCollection(collection));

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        >
        <Text style={styles.text}>Submit Survey</Text>
      </TouchableOpacity>
      {surveySummary.map((collection, index) => (
        <View key={index}>
          {collection.totalItems > 0 ? (
            <Text>{collection.name}: {collection.itemsWithObservations} / {collection.totalItems}</Text>
          ) : (
            <>
              <Text>{collection.name}</Text>
              {collection.subCollections.map((subCollection, subIndex) => (
                <View key={subIndex} style={localStyles.subCollection}>
                  <Text>{subCollection.name}: {subCollection.itemsWithObservations} / {subCollection.totalItems}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      ))}
    </View>
  );

};

const localStyles = StyleSheet.create({
  subCollection: {
    marginLeft: 20,
  },

});

export default SubmitSurvey;