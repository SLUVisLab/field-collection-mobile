import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import SurveyItem from '../utils/SurveyItem';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';


const NewItem = ({ route, navigation }) => {

    // Initialize the survey design context
    const { surveyDesign, addItemToCollection} = useSurveyDesign();

    const { parentID, item } = route.params || { parentID: null, item: null };

    const [itemName, setItemName] = useState('');

    React.useLayoutEffect(() => {
      navigation.setOptions({
        title: item ? item.name : 'New Item',
      });
      if(item) {
        setItemName(item.name);
      }
    }, [navigation]);

    const validateFields = () => {
      const newErrors = {};
      if (!itemName) newErrors.itemName = 'Item Name cannot be empty';
      return newErrors;
    };

  
    const handleDone = () => {
      const validationErrors = validateFields();
      if (Object.keys(validationErrors).length > 0) {
          Alert.alert(
              "Please fix the following errors:",
              Object.values(validationErrors).join('\n')
          );
          return;
      }

      console.log('item Name:', itemName);
      console.log('parentID:', parentID);

      let newItem = new SurveyItem({name: itemName, collectionID: parentID});

      addItemToCollection(parentID, newItem)

      navigation.navigate("CollectionDesignList", { collectionID: parentID })

    };
  
    return (
      <View style={styles.container}>
        <View style={styles.inputLabelContainer}>
            <Text style={styles.inputLabel}>Item Name:</Text>
        </View>
        <TextInput
          style={styles.textInput}
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
  
  export default NewItem;