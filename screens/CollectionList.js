import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TouchableWithoutFeedback, Alert } from 'react-native';
import styles from '../Styles';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesome } from '@expo/vector-icons';
import ItemPicker from '../components/ItemPicker';

const CollectionList = ({ route, navigation }) => {
  // Initialize the survey design context
  const { surveyDesign, addCollection, findCollectionByID } = useSurveyDesign();
  const { itemHasObservation, moveObservationToItem, deleteObservationByItemID } = useSurveyData()

  const [isEditMode, setIsEditMode] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [selectedSourceItem, setSelectedSourceItem] = useState(null);
  const [selectedSourceCollection, setSelectedSourceCollection] = useState(null);

  const toggleEditMode = () => setIsEditMode(!isEditMode);

  // Function to exit edit mode
  const exitEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false);
    }
  };

  const handleMoveData = (item, collection) => {
    console.log('Move data for item:', item.name, 'in collection:', collection.name);
    setSelectedSourceItem(item);
    setSelectedSourceCollection(collection);
    setShowItemPicker(true);
  };

  const handleDeleteData = (item, collection) => {
    Alert.alert(
      'Delete Data',
      `Are you sure you want to delete all data recorded for "${collection.name} > ${item.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteObservationByItemID(item.ID);
              Alert.alert('Success', `Data deleted for "${collection.name} > ${item.name}"`);
            } catch (error) {
              console.error('Error deleting data:', error);
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleItemPickerSelect = (targetItem, targetCollection) => {
    console.log('Selected target:', targetItem.name, 'in collection:', targetCollection.name);
    
    // Show confirmation dialog
    Alert.alert(
      'Move Data',
      `Are you sure you want to move data from "${selectedSourceCollection.name} > ${selectedSourceItem.name}" to "${targetCollection.name} > ${targetItem.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Move',
          style: 'destructive',
          onPress: () => {
            try {
              // Move the observation data to the target item
              moveObservationToItem(selectedSourceItem.ID, targetItem, targetCollection);
              
              setShowItemPicker(false);
              setIsEditMode(false);
              setSelectedSourceItem(null);
              setSelectedSourceCollection(null);
              
              Alert.alert('Success', `Data moved from "${selectedSourceCollection.name} > ${selectedSourceItem.name}" to "${targetCollection.name} > ${targetItem.name}"`);
            } catch (error) {
              console.error('Error moving data:', error);
              Alert.alert('Error', 'Failed to move data. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleItemPickerClose = () => {
    setShowItemPicker(false);
    setSelectedSourceItem(null);
    setSelectedSourceCollection(null);
  };

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
        <TouchableWithoutFeedback onPress={exitEditMode}>
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              {/* <Text>CASE 2.2</Text> */}
              {collection.items.map((item) => (
                <TouchableOpacity
                  style={[
                    styles.surveyItemButton,
                    { 
                      borderColor: itemHasObservation(item.ID) ? 'green' : (isEditMode ? 'rgba(0,0,0,0.2)' : 'transparent'), 
                      borderWidth: 1.5 
                    },
                    isEditMode && localStyles.editMode
                  ]}
                  key={item.ID}
                  onPress={() => !isEditMode && navigation.navigate('TaskAction', { itemID: item.ID, collectionID: collection.ID })}
                  onLongPress={toggleEditMode}
                >
                  <View style={localStyles.buttonContentContainer}>
                    <Text style={{ flex: 1 }}>{item.name}</Text>
                    {isEditMode && (
                      <View style={localStyles.editButtonsContainer}>
                        {itemHasObservation(item.ID) ? (
                          <>
                            <TouchableOpacity
                              style={localStyles.moveButton}
                              onPress={(e) => {
                                e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                                handleMoveData(item, collection);
                              }}
                            >
                              <Ionicons name="swap-horizontal" size={24} color="blue" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={localStyles.deleteButton}
                              onPress={(e) => {
                                e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
                                handleDeleteData(item, collection);
                              }}
                            >
                              <Ionicons name="trash" size={24} color="red" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <Text style={localStyles.noDataText}>No data</Text>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {isEditMode && (
              <TouchableOpacity 
                style={localStyles.exitEditModeButton}
                onPress={exitEditMode}
              >
                <Text style={localStyles.exitEditModeText}>Done</Text>
              </TouchableOpacity>
            )}
            
            <ItemPicker
              visible={showItemPicker}
              onClose={handleItemPickerClose}
              onSelect={handleItemPickerSelect}
              sourceItem={selectedSourceItem}
              targetCanHaveExistingData={false}
            />
          </View>
        </TouchableWithoutFeedback>
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
      {isEditMode && (
        <TouchableOpacity 
          style={localStyles.exitEditModeButton}
          onPress={exitEditMode}
        >
          <Text style={localStyles.exitEditModeText}>Done</Text>
        </TouchableOpacity>
      )}
      
      <ItemPicker
        visible={showItemPicker}
        onClose={handleItemPickerClose}
        onSelect={handleItemPickerSelect}
        sourceItem={selectedSourceItem}
        targetCanHaveExistingData={false}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 20, // Adds some padding at the bottom of the scrollable content
  },
  buttonContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  editMode: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    backgroundColor: '#FFF',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  moveButton: {
    padding: 5,
    marginRight: 16,
  },
  deleteButton: {
    padding: 5,
  },
  noDataText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  exitEditModeButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  exitEditModeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CollectionList;