import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import styles from '../Styles';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useFileContext } from '../contexts/FileContext';
import { se } from 'date-fns/locale';

import { useRealm } from '@realm/react';

const SurveyBuilder = ({ route, navigation }) => {

  const { surveyDesign, saveSurveyDesign, setName, addTask, deleteTaskByID } = useSurveyDesign();
  const { convertSurveyToXLSX, loadSurveyFiles } = useFileContext();
  
  const realm = useRealm();

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = () => setIsEditMode(!isEditMode);

  // Function to exit edit mode
  const exitEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false);
    }
  };

  // Change the title dynamically
  const nav = useNavigation();

  React.useLayoutEffect(() => {
    // setName(route.params.name)

    nav.setOptions({
      // title: route.params.name // Set the new title here
      title: surveyDesign.name
    });
  }, [surveyDesign]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      // Component is mounted, which means this is not the first render
      setHasUnsavedChanges(true);
    } else {
      // Component has just mounted, so we skip setting unsaved changes
      isMounted.current = true;
    }
  }, [surveyDesign]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = (action) => {
        
        if (!hasUnsavedChanges) {
          // If there are no unsaved changes, allow navigation
          navigation.dispatch(action);
          return false; // No need to show the alert
        }

        Alert.alert(
          'Discard changes?',
          'You have unsaved changes. Are you sure you want to discard them and leave the screen?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => null },
            {
              text: 'Discard',
              style: 'destructive',
              // If the user confirms, allow the back action
              onPress: () => {
                setHasUnsavedChanges(false);
                navigation.dispatch(action)
              },
            },
          ],
          { cancelable: false },
        );

        // By returning `true`, we prevent the default back behavior
        return true;
      };

      // Add event listener for the beforeRemove event
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (!hasUnsavedChanges) {
          // If there are no unsaved changes, do nothing
          return;
        }
        // Prevent the default behavior of removing the screen
        e.preventDefault();

        // Call the function to show the alert dialog
        onBackPress(e.data.action);
      });

      return unsubscribe;
    }, [navigation, hasUnsavedChanges])
  );


  const handleCollections = () => {
    // Navigation logic to navigate to Collections screen
    navigation.navigate('CollectionDesignList');
  };

  const handleNewTask = () => {
    // Navigation logic to navigate to New Task screen
    navigation.navigate('TaskSelector');
  };

  // Function to handle item press
  const handleEditTask = (task) => {
    navigation.navigate('TaskSetup', { taskTypeID: task.constructor.typeID, taskID: task.taskID });
  };

  const handleDone = async () => {
    console.log("Called method to save survey")
    console.log(surveyDesign)
    await convertSurveyToXLSX(surveyDesign);
    loadSurveyFiles()
    setHasUnsavedChanges(false);

    Toast.show({
      type: 'success',
      position: 'bottom',
      text1: 'Survey Saved Successfully',
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 30,
      bottomOffset: 40,
    });

    navigation.navigate('Home')
  };

  const handleDoneMongo = async () => {
    console.log("Called method to save survey")
    console.log(surveyDesign)
    
    try {
      await saveSurveyDesign(realm)
      console.log("Survey saved successfully")

      setHasUnsavedChanges(false);

      Toast.show({
        type: 'success',
        position: 'bottom',
        text1: 'Survey Saved Successfully',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 30,
        bottomOffset: 40,
      });

      navigation.navigate('Home')
    } catch (error) {
      console.error("Survey save failed", error);
      Toast.show({
        type: 'error', // Adjust the type based on your toast library's configuration
        text1: 'Survey Save Failed',
        text2: 'There was a problem saving your survey. Please try again.',
        position: 'bottom',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 30,
        bottomOffset: 40,
      });

    }
  };

  const handleDeleteTask = (taskID) => {
    console.log("Called method to delete task")
    console.log(taskID)
    deleteTaskByID(taskID);
  }

  //create list element
  const renderTaskItem = ({ item }) => (
    <TouchableOpacity
      key={item.taskID} 
      onPress={() => !isEditMode && handleEditTask(item)}
      onLongPress={toggleEditMode}
      
    >
      <View style={localStyles.taskItemButton}>
        {React.createElement(item.constructor.typeIcon, { style: localStyles.taskIcon, size: 28 })}
        <View style = {localStyles.info}>
          <Text style={localStyles.taskName}>{item.taskDisplayName}</Text>
          <Text style={localStyles.taskDescription}>{item.constructor.typeDisplayName}</Text>
        </View>
        {isEditMode && (
          <TouchableOpacity
            style={[localStyles.deleteButton, { marginLeft: 'auto' }]} // Adjust positioning as needed
            onPress={(e) => {
              e.stopPropagation(); // Prevent the parent TouchableOpacity from triggering
              handleDeleteTask(item.taskID);
            }}
          >
            <Ionicons name="close-circle" size={24} color="red" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleCollections}
      >
        <Text style={styles.text}>Collections</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Tasks</Text>
        <View style={styles.horizontalLine} />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleNewTask}
      >
        <Text style={styles.text}>New Task</Text>
      </TouchableOpacity>
      <FlatList
        data={surveyDesign.tasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.taskID.toString()}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleDoneMongo}
      >
        <Text style={styles.text}>Save</Text>
      </TouchableOpacity>
    </View>
  );
};

const localStyles = StyleSheet.create({
  taskItemButton: {
    textAlign: 'left',
    paddingVertical: 12,
    marginVertical: 3,
    marginHorizontal: 16,
    paddingHorizontal: 24,
    borderRadius: 3,
    elevation: 3,
    backgroundColor: 'white',
    flexDirection: 'row',
  },
  taskName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  taskDescription: {
    marginLeft: 10,
  },
  taskIcon: {
    justifyContent: 'center',
  },
  info: {
    flexDirection: 'column'
  },
});

export default SurveyBuilder;