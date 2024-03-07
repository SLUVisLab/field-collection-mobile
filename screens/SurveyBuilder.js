import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from '../Styles';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useFileContext } from '../contexts/FileContext';

const SurveyBuilder = ({ route, navigation }) => {

  const { surveyDesign, setName, addTask } = useSurveyDesign();
  const { convertSurveyToXLSX } = useFileContext();

  // Get survey name from previous view and save to survey context
  

  // Change the title dynamically
  const nav = useNavigation();

  React.useLayoutEffect(() => {
    // setName(route.params.name)

    setName("test")

    nav.setOptions({
      // title: route.params.name // Set the new title here
      title: "test"
    });
  }, [navigation]);


  // TODO: remove this whole property as it doesnt really make sense and could only be updated from another context
  const lastCompleted = surveyDesign.lastSubmitted ? surveyDesign.lastSubmitted : "N/A";


  const handleCollections = () => {
    // Navigation logic to navigate to Collections screen
    navigation.navigate('Collection');
  };

  const handleNewTask = () => {
    // Navigation logic to navigate to New Task screen
    navigation.navigate('TaskSelector');
  };

  // Function to handle item press
  const handleEditTask = (task) => {
    navigation.navigate('TaskSetup', { taskTypeID: task.constructor.typeID, taskID: task.taskID });
  };

  const handleDone = () => {
    console.log("Called method to save survey")
    console.log(surveyDesign)
    convertSurveyToXLSX(surveyDesign)
  };

  //create list element
  const renderTaskItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleEditTask(item)}>
      <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
        <Text>{item.taskDisplayName}</Text>
        <Text>{item.constructor.typeDisplayName}</Text>
        <Text>{item.constructor.typeID}</Text>
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
        <Text style={styles.text}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SurveyBuilder;