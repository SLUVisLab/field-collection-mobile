import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import ProgressBar from 'react-native-progress/Bar';
import { format } from 'date-fns';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';

const SubmitSurvey = ({ route, navigation }) => {
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();
  const { itemHasObservation, surveyData } = useSurveyData()

  // Recursive function to check items in collections and subcollections
  const checkItemsInCollection = (collection) => {
    let totalItems = 0;
    let itemsWithObservations = 0;
    let subCollections = [];

    //TODO: Implement stronger checks for ensuring collections can have items OR sub but not both.
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

  let totalItemsWithObservations = 0;
  let totalItemsInSurvey = 0;

  const calculateTotals = (collection) => {
    totalItemsInSurvey += collection.totalItems;
    totalItemsWithObservations += collection.itemsWithObservations;

    // If the collection has subcollections, calculate their totals as well
    if (collection.subCollections.length > 0) {
      collection.subCollections.forEach(subCollection => calculateTotals(subCollection));
    }
  };

  // Calculate the totals for each collection in the survey
  surveySummary.forEach(collection => calculateTotals(collection));

  return (
    <View style= {{ padding: 10 }}>
      <Text style={localStyles.header}>{surveyDesign.name}</Text>

      <View style={localStyles.infoContainer}>
        <View style={localStyles.summaryLabelContainer}>
          <Text style={localStyles.summaryLabel}>Started at: </Text>
          <Text>{format(new Date(surveyData.startTime), 'eee, MM/dd/yy hh:mm a')}</Text>
        </View>
        <View style={localStyles.summaryLabelContainer}>
          <Text style={localStyles.summaryLabel}>Recorded Observations: </Text>
          <Text>{totalItemsWithObservations}</Text>
        </View>
        <View style={localStyles.summaryLabelContainer}>
          <Text style={localStyles.summaryLabel}>Total Items: </Text>
          <Text>{totalItemsInSurvey}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        >
        <Text style={styles.text}>Submit Survey</Text>
      </TouchableOpacity>
      <View style={styles.horizontalLine} />
      <Text style={styles.headerText}>Breakdown</Text>
      {surveySummary.map((collection, index) => (
        <View key={index}>
          {collection.totalItems > 0 ? (
            <View>
              <View style={localStyles.progressLabelContainer}> 
                <Text>{collection.name}</Text>
                <Text>{collection.itemsWithObservations} / {collection.totalItems}</Text>
              </View>
              <ProgressBar progress={collection.itemsWithObservations/collection.totalItems} width={340} />
            </View>
          ) : (
            <>
              <Text>{collection.name}</Text>
              {collection.subCollections.map((subCollection, subIndex) => (
                <View key={subIndex} style={localStyles.subCollection}>
                  <View style={localStyles.progressLabelContainer}>
                    <Text>{subCollection.name}</Text>
                    <Text>{subCollection.itemsWithObservations} / {subCollection.totalItems}</Text>
                  </View>
                  <ProgressBar progress={subCollection.itemsWithObservations/subCollection.totalItems} width={340} />
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10
  },
  summaryLabelContainer: {
    flexDirection: 'row',
  },
  summaryLabel: {
    fontWeight: 'bold',
  },
  infoContainer: {
    marginBottom: 30,
  }

});

export default SubmitSurvey;