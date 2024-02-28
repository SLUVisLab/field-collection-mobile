import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from '../Styles';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';

const SurveyBuilder = ({ route, navigation }) => {

  const { surveyDesign, setName, addTask } = useSurveyDesign();

  // Change the title dynamically
  const nav = useNavigation();

  React.useLayoutEffect(() => {
    // Get survey name from previous view and set to context
    setName(route.params.name)

    nav.setOptions({
      title: route.params.name, // Set the new title here
    });
  }, [navigation]);


  // TODO: remove this whole property as it doesnt really make sense and could only be updated from another context
  const lastCompleted = surveyDesign.lastSubmitted ? surveyDesign.lastSubmitted : "N/A";


  const handleCollections = () => {
    // Navigation logic to navigate to Collections screen
    navigation.navigate('Collections');
  };

  const handleNewTask = () => {
    // Navigation logic to navigate to New Task screen
    navigation.navigate('TaskSelector');
  };

  const handleDone = () => {
    // Navigation logic to navigate to New Task screen
    // navigation.navigate('NewTask');
  };

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