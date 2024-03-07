import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import SurveyItem from '../utils/SurveyItem';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';


const ItemName = ({ route, navigation }) => {

    // Initialize the survey design context
    const { surveyDesign, addItemToCollection} = useSurveyDesign();

    const { parentID } = route.params || { parentID: null };

    const [itemName, setItemName] = useState('');
  
    const handleDone = () => {

      console.log('item Name:', itemName);
      console.log('parentID:', parentID);

      let newItem = new SurveyItem(itemName)

      addItemToCollection(parentID, newItem)

      navigation.navigate("Collection", { collectionID: parentID })

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