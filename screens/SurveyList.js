import React from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

const SurveyList = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('SurveyName')}
          >
            <Text style={styles.text}>New Survey</Text>
          </TouchableOpacity>
    </View>
  );
};


export default SurveyList;