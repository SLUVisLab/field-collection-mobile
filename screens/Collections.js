import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';

const Collections = ({ navigation }) => {

  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('CollectionName')}
      >
        <Text style={styles.text}>New Collection</Text>
      </TouchableOpacity>
     
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ItemName')}
      >
        <Text style={styles.text}>New Item</Text>
      </TouchableOpacity>

    </View>
  );
};

export default Collections;