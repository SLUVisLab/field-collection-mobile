import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';

const TaskSelector = ({ navigation }) => {

  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('TaskPhoto')}
      >
        <Text style={styles.text}>Photo</Text>
      </TouchableOpacity>
     
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('TaskShortText')}
      >
        <Text style={styles.text}>Short Text</Text>
      </TouchableOpacity>

    </View>
  );
};

export default TaskSelector;