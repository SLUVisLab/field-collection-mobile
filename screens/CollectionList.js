import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import styles from '../Styles';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';

import { FontAwesome } from '@expo/vector-icons';

const CollectionList = ({ route, navigation }) => {
  // Initialize the survey design context
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();
  const { itemHasObservation } = useSurveyData()

  const { collectionID } = route.params || { collectionID: null };

  console.log("Collection ID:")
  console.log(collectionID)

  // Find the collection associated with the provided ID
  const collection = collectionID ? findCollectionByID(collectionID) : null;

  if(collection){
    console.log("Collection Found")
  }

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: collection ? collection.name : 'Collections',
      headerRight: () => (
        <TouchableOpacity onPress={() => {
          navigation.navigate('SaveSurvey')
        }}>
          <FontAwesome name="save" size={42} color="black" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, collection]);


  // This is not very clean code, but basically conforms to the following convention:
  // A collection can contain nested sub-collections OR individual survey items, NOT both.
  // Also, subcollections can only be nested 1 layer deep.
  // Potential setups:
  // a. collection/item, item, item
  // b. collection/subcollection1/item item item, /subcollection2/item, item, item

  // Scenario 1:Base Level Collections
  if (!collectionID) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {surveyDesign.collections.map((collection) => (
          <TouchableOpacity
            key={collection.ID}
            onPress={() => navigation.push('CollectionList', { collectionID: collection.ID })}
            style={styles.surveyCollectionButton}
          >
            <Text>{collection.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }
  if (collection) {  
    //Scenario 2.2: Items exist
    if(collection.items.length){
      return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* <Text>CASE 2.2</Text> */}
          {collection.items.map((item) => (
            <TouchableOpacity
              style={[
                styles.surveyItemButton,
                { borderColor: itemHasObservation(item.ID) ? 'green' : 'transparent', borderWidth: 1.5 }
              ]}
              key={item.ID}
              onPress={() => navigation.navigate('TaskAction', { itemID: item.ID, collectionID: collection.ID })}
            >
              <Text>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )
    }
    
    // Scenario 2.3: subcollections Exist
    if(collection.subCollections.length) {
      return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* <Text>CASE 2.3</Text> */}
          {collection.subCollections.map((subcollection) => (
            <TouchableOpacity
              style={styles.surveyCollectionButton}
              key={subcollection.ID}
              onPress={() => navigation.push('CollectionList', { collectionID: subcollection.ID })}
            >
              <Text>{subcollection.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
  }

  // Default case
  return (
    <View>
      <Text>No data available.</Text>
    </View>
  );
};

const localStyles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 20, // Adds some padding at the bottom of the scrollable content
  }
});

export default CollectionList;