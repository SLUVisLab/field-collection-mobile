import React from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';

const CollectionDesignList = ({ route, navigation }) => {
  // Initialize the survey design context
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();

  const { collectionID } = route.params || { collectionID: null };

  console.log("Collection ID:")
  console.log(collectionID)

  // Find the collection associated with the provided ID
  const collection = collectionID ? findCollectionByID(collectionID) : null;

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
        {/* <Text>CASE 1</Text> */}
        {surveyDesign.collections.map((item) => (
          <TouchableOpacity
            style={styles.surveyCollectionButton}
            key={item.ID}
            onPress={() => navigation.push('CollectionDesignList', { collectionID: item.ID })}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={localStyles.addButton}
          onPress={() => navigation.navigate('CollectionName')}
        >
          <Ionicons name="add-circle-outline" size={24} color="black" />
          <Text style = {localStyles.addText}>Add Collection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Scenario 2: Specific Collection or subCollection
  if (collection) {

    //Scenario 2.1: IF No subcollections or Items present
    // THEN both item and collection buttons should be shown
    if (!collection.subCollections.length && !collection.items.length && !collection.parent) {
      return (
        <View>
          {/* <Text>CASE 2.1</Text> */}
          <TouchableOpacity
            style={localStyles.addButton}
            onPress={() => navigation.navigate('NewItem', {parentID: collectionID})}
          >
            <Ionicons name="add-circle-outline" size={24} color="black" />
            <Text style = {localStyles.addText}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={localStyles.addButton}
            onPress={() => navigation.navigate('CollectionName', { parentID: collection.ID, parentName: collection.name})}
          >
            <Ionicons name="add-circle-outline" size={24} color="black" />
            <Text style = {localStyles.addText}>Add Collection</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    //Scenario 2.2: IF Items exist OR this is an empty subcollection
    // THEN only item buttons should be shown.
    if(collection.items.length || collection.parent ){
      return (
        <View>
          {/* <Text>CASE 2.2</Text> */}
          {collection.items.map((item) => (
            <TouchableOpacity
              style={styles.surveyItemButton}
              key={item.ID}
              onPress={() => navigation.navigate('NewItem', { item: item })}
            >
              <Text>{item.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={localStyles.addButton}
            onPress={() => navigation.navigate('NewItem', { parentID: collectionID })}
          >
            <Ionicons name="add-circle-outline" size={24} color="black" />
            <Text style = {localStyles.addText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      )
    }
    
    // Scenario 2.3: IF subcollections exist
    // THEN only collection buttons should be shown
    if(collection.subCollections.length) {
      return (
        <View>
          {/* <Text>CASE 2.3</Text> */}
          {collection.subCollections.map((subcollection) => (
            <TouchableOpacity
              style={styles.surveyCollectionButton}
              key={subcollection.ID}
              onPress={() => navigation.push('CollectionDesignList', { collectionID: subcollection.ID })}
            >
              <Text>{subcollection.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={localStyles.addButton}
            onPress={() => navigation.navigate('CollectionName', { parentID: collection.ID, parentName: collection.name })}
          >
            <Ionicons name="add-circle-outline" size={24} color="black" />
            <Text style = {localStyles.addText}>Add Collection</Text>
          </TouchableOpacity>
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

const localStyles = StyleSheet.create({
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
  }

});

export default CollectionDesignList;