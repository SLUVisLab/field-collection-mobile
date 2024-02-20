import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

const ItemName = ({ navigation }) => {
    const [itemName, setItemName] = useState('');
  
    const handleDone = () => {
      // You can perform actions here when the "Done" button is pressed
      console.log('Item Name:', itemName);
      navigation.navigate("Collections")
      // You can navigate to another screen or perform other actions as needed
    };
  
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Item Name</Text>
        <TextInput
          style={styles.input}
          onChangeText={text => setItemName(text)}
          value={itemName}
          placeholder="Enter item name"
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
  
  export default ItemName;