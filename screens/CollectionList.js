import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';

const CollectionList = ({ route, navigation }) => {
  // Initialize the survey design context
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();

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
    });
  }, [navigation, collection]);


  // This is not very clean code, but basically conforms to the following convention:
  // A collection can contain nested sub-collections OR individual survey items, NOT both.
  // Also, subcollections can only be nested 1 layer deep.
  // Potential setups:
  // a. collection/item, item, item
  // b. collection/subcollection1/item item item, /subcollection2/item, item, item

  // Scenario 1: New Base Level Collection
  if (!collectionID) {
    return (
      <View>
        {surveyDesign.collections.map((item) => (
          <TouchableOpacity
            key={item.ID}
            onPress={() => navigation.navigate('CollectionList', { collectionID: item.ID })}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  if (collection) {  
    //Scenario 2.2: Items exist OR this is an empty subcollection
    if(collection.items.length || collection.parent ){
      return (
        <View>
          {/* <Text>CASE 2.2</Text> */}
          {collection.items.map((item) => (
            <TouchableOpacity
              key={item.ID}
              onPress={() => navigation.navigate('ItemName', { itemID: item.ID })}
            >
              <Text>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )
    }
    
    // Scenario 2.3: subcollections Exist
    if(collection.subCollections.length) {
      return (
        <View>
          {/* <Text>CASE 2.3</Text> */}
          {collection.subCollections.map((subcollection) => (
            <TouchableOpacity
              key={subcollection.ID}
              onPress={() => navigation.navigate('CollectionList', { collectionID: subcollection.ID })}
            >
              <Text>{subcollection.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
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

export default CollectionList;