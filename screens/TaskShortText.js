import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import styles from '../Styles';

const TaskShortText = ({ navigation }) => {
  const [name, setName] = useState('');
  const [inputType, setInputType] = useState('Text');
  const [characterLimit, setCharacterLimit] = useState('');

  const handleAddTask = () => {
    // Logic to add task
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
      <Text style={styles.label}>Character Limit:</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setCharacterLimit(text)}
        value={characterLimit}
        placeholder="Enter character limit"
        keyboardType="numeric"
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleAddTask}
      >
        <Text style={styles.text}>Add</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TaskShortText;