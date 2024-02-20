import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';

const SurveyBuilder = ({ navigation }) => {
  const lastCompleted = 'N/A'; // Default value is N/A

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