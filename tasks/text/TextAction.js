import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../../Styles';



const TextAction = ({ navigation, existingData, onComplete, task, item }) => {

    const [data, setData] = useState('');

    useEffect(() => {
        navigation.setOptions({ title: task.taskDisplayName });
    }, []);

    useEffect(() => {
        if(task && task.dataLabel && existingData[task.dataLabel]) {
            console.log("existing text task data found")
    
            setData(existingData[task.dataLabel])
        }
    }, [task, existingData]);

    const handleDone = () => {

        onComplete({ [task.dataLabel]: data });
  
      };

    return (
        <View>
        <Text>{item.name}</Text>
        <View>
            <View style={styles.inputLabelContainer}>
                <Text style={styles.inputLabel}>{task.dataLabel}</Text>
            </View>
            <TextInput
                style={styles.textInput}
                value={data}
                onChangeText={setData}
            />
        </View>
        <Text>{task.instructions}</Text>
        <TouchableOpacity
              style={styles.button}
              onPress={handleDone}
              >
              <Text style={styles.text}>Done</Text>
          </TouchableOpacity>
      </View>
    );
  };
  
  export default TextAction;