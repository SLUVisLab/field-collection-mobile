import React, { useState } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, ScrollView, TouchableWithoutFeedback } from 'react-native';
import styles from '../Styles';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';

const CollectionDesignList = ({ route, navigation }) => {
  // Initialize the survey design context
  const { surveyDesign, addCollection, findCollectionByID, deleteTaskByID, deleteCollectionByID, deleteItemFromCollection } = useSurveyDesign();
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = () => setIsEditMode(!isEditMode);

  // Function to exit edit mode
  const exitEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false);
    }
  };

  const handleDeleteCollection = (collectionID) => {
    if (isEditMode) {
      console.log('Deleting collection with ID: ', collectionID);
      deleteCollectionByID(collectionID);
    }
  };

  const handleDeleteItem = (collectionID, itemID) => {
    if (isEditMode) {
      console.log('Deleting item with ID: ', itemID);
      console.log('From collection with ID: ', collectionID);
      deleteItemFromCollection(collectionID, itemID);
    }
  };
  

  const { collectionID } = route.params || { collectionID: null };

  // Find the collection associated with the provided ID
  const collection = collectionID ? findCollectionByID(collectionID) : null;

  React.useLayoutEffect(() => {
    let collectionName = collection ? collection.name : 'Collections';
    let parentName = collection ? collection.parentName : null;
    navigation.setOptions({
      title: parentName ? `${parentName} > ${collectionName}` : collectionName,
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
      <TouchableWithoutFeedback onPress={exitEditMode}>
        <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1 }}>
          {/* <Text>CASE 1</Text> */}
          {surveyDesign.collections.map((collection) => (
              <TouchableOpacity
                style={[localStyles.surveyCollectionButton, isEditMode && localStyles.editMode]}
                key={collection.ID}
                onLongPress={toggleEditMode}
                onPress={() => !isEditMode && navigation.push('CollectionDesignList', { collectionID: collection.ID })}
              >
                <View style={localStyles.buttonContentContainer}>
                  <Text style={{ flex: 1 }}>{collection.name}</Text>
                  {isEditMode && (
                    <TouchableOpacity
                      style={[localStyles.deleteButton, { marginLeft: 'auto' }]} // Adjust positioning as needed
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                        handleDeleteCollection(collection.ID);
                      }}
                    >
                      <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={localStyles.addButton}
            onPress={() => !isEditMode && navigation.navigate('CollectionName')}
          >
            <Ionicons name="add-circle-outline" size={24} color="black" />
            <Text style = {localStyles.addText}>Add Collection</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
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
            <Text style = {localStyles.addText}>Add Subcollection</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    //Scenario 2.2: IF Items exist OR this is an empty subcollection
    // THEN only item buttons should be shown.
    if(collection.items.length || collection.parent ){
      return (
        <TouchableWithoutFeedback onPress={exitEditMode}>
          <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1 }}>
            {/* <Text>CASE 2.2</Text> */}
            {collection.items.map((item) => (
              <TouchableOpacity
                style={[localStyles.surveyItemButton, isEditMode && localStyles.editMode]}
                key={item.ID}
                onLongPress={toggleEditMode}
                onPress={() => !isEditMode && navigation.navigate('NewItem', { item: item })}
              >
                <View style={localStyles.buttonContentContainer}>
                  <Text style={{ flex: 1 }}>{item.name}</Text>
                  {isEditMode && (
                    <TouchableOpacity
                      style={[localStyles.deleteButton, { marginLeft: 'auto' }]} // Adjust positioning as needed
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                        handleDeleteItem(collection.ID, item.ID);
                      }}
                    >
                      <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={localStyles.addButton}
              onPress={() => !isEditMode && navigation.navigate('NewItem', { parentID: collectionID })}
            >
              <Ionicons name="add-circle-outline" size={24} color="black" />
              <Text style = {localStyles.addText}>Add Item</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      )
    }
    
    // Scenario 2.3: IF subcollections exist
    // THEN only collection buttons should be shown
    if(collection.subCollections.length) {
      return (
        <TouchableWithoutFeedback onPress={exitEditMode}>
          <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1 }}>
            {collection.subCollections.map((subcollection) => (
                <TouchableOpacity
                  style={[localStyles.surveyCollectionButton, isEditMode && localStyles.editMode]}
                  key={subcollection.ID}
                  onLongPress={toggleEditMode}
                  onPress={() => !isEditMode && navigation.push('CollectionDesignList', { collectionID: subcollection.ID })}
                >
                  <View style={localStyles.buttonContentContainer}>
                    <Text style={{ flex: 1 }}>{subcollection.name}</Text>
                    {isEditMode && (
                      <TouchableOpacity
                        style={[localStyles.deleteButton, { marginLeft: 'auto' }]} // Adjust positioning as needed
                        onPress={(e) => {
                          e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                          handleDeleteCollection(subcollection.ID);
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color="red" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={localStyles.addButton}
              onPress={() => !isEditMode && navigation.navigate('CollectionName', { parentID: collection.ID, parentName: collection.name })}
            >
              <Ionicons name="add-circle-outline" size={24} color="black" />
              <Text style = {localStyles.addText}>Add Collection</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
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
  // buttonContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  // },
  buttonContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
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
  surveyItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    textAlign: 'left',
    paddingVertical: 12,
    marginVertical: 3,
    marginHorizontal: 16,
    paddingHorizontal: 32,
    borderRadius: 3,
    elevation: 3,
    backgroundColor: 'white'
  },
  surveyCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    textAlign: 'left',
    paddingVertical: 12,
    marginVertical: 3,
    marginHorizontal: 16,
    paddingHorizontal: 32,
    borderRadius: 3,
    elevation: 3,
    backgroundColor: 'white',
  },
  editMode: {
    borderWidth: 1, // Adds a border to the button
    borderColor: 'rgba(0,0,0,0.2)', // Darkly shaded border color
    shadowColor: '#000', // Shadow color for iOS
    shadowOffset: { width: 0, height: 2 }, // Shadow position for iOS
    shadowOpacity: 0.25, // Shadow opacity for iOS
    shadowRadius: 3.84, // Shadow blur radius for iOS
    elevation: 5, // Elevation for Android to create shadow
    backgroundColor: '#FFF', // Button background color, adjust as needed
  },
  scrollContainer: {
    paddingBottom: 20, // Adds some padding at the bottom of the scrollable content
  }

});

export default CollectionDesignList;