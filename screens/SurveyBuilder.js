import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import styles from '../Styles';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useFileContext } from '../contexts/FileContext';

const SurveyBuilder = ({ route, navigation }) => {

  const { surveyDesign, setName, addTask } = useSurveyDesign();
  const { convertSurveyToXLSX, loadSurveyFiles } = useFileContext();

  // Get survey name from previous view and save to survey context
  

  // Change the title dynamically
  const nav = useNavigation();

  React.useLayoutEffect(() => {
    // setName(route.params.name)

    nav.setOptions({
      // title: route.params.name // Set the new title here
      title: surveyDesign.name
    });
  }, [surveyDesign]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = (action) => {
        Alert.alert(
          'Discard changes?',
          'You have unsaved changes. Are you sure you want to discard them and leave the screen?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => null },
            {
              text: 'Discard',
              style: 'destructive',
              // If the user confirms, allow the back action
              onPress: () => navigation.dispatch(action),
            },
          ],
          { cancelable: false },
        );

        // By returning `true`, we prevent the default back behavior
        return true;
      };

      // Add event listener for the beforeRemove event
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // Prevent the default behavior of removing the screen
        e.preventDefault();

        // Call the function to show the alert dialog
        onBackPress(e.data.action);
      });

      return unsubscribe;
    }, [navigation])
  );


  // TODO: remove this whole property as it doesnt really make sense and could only be updated from another context
  const lastCompleted = surveyDesign.lastSubmitted ? surveyDesign.lastSubmitted : "N/A";


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

  //create list element
  const renderTaskItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleEditTask(item)}>
      <View style={localStyles.taskItemButton}>
        {React.createElement(item.constructor.typeIcon, { style: localStyles.taskIcon, size: 28 })}
        <View style = {localStyles.info}>
          <Text style={localStyles.taskName}>{item.taskDisplayName}</Text>
          <Text style={localStyles.taskDescription}>{item.constructor.typeDisplayName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.lastCompletedText}>Last completed: {lastCompleted}</Text>
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
        onPress={handleDone}
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