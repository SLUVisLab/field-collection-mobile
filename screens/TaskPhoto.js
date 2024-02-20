import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet } from 'react-native';
import styles from '../Styles';

const TaskPhoto = ({ navigation }) => {
  const [name, setName] = useState('');
  const [numberOfPhotos, setNumberOfPhotos] = useState('');
  const [askForConfirmation, setAskForConfirmation] = useState(false);

  const handleAddTask = () => {
    navigation.navigate('SurveyBuilder');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name:</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setName(text)}
        value={name}
        placeholder="Enter task name"
      />
      <Text style={styles.label}>Number of photos to take. (Leave blank for unlimited):</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setNumberOfPhotos(text)}
        value={numberOfPhotos}
        placeholder="Enter number of photos"
        keyboardType="numeric"
      />
      <View style={styles.rowContainer}>
        <Text style={styles.label}>Ask For Photo Confirmation:</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={askForConfirmation ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={value => setAskForConfirmation(value)}
          value={askForConfirmation}
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleAddTask}
      >
        <Text style={styles.text}>Add</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TaskPhoto;