import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from '../../Styles';
import PhotoTask from './PhotoTask';
import { useSurveyDesign } from '../../contexts/SurveyDesignContext';

const PhotoSetup = ({navigation, taskID}) => {

    // initialize the survey desgin context
    const { surveyDesign, setName, addTask, updateTask, getTaskByID } = useSurveyDesign();

    const [displayName, setDisplayName] = useState('');
    const [dataLabel, setDataLabel] = useState('');
    const [instructions, setInstructions] = useState('');

    useEffect(() => {
        // Fetch task data based on taskID
        if (taskID) {
          //Get existing task data
          const existingTask = getTaskByID(taskID)
          
          if(existingTask){
            setDisplayName(existingTask.taskDisplayName)
            setDataLabel(existingTask.dataLabel)
            setInstructions(existingTask.instructions)
          } else {
            console.log("Unable to retrieve task by ID")
          }
        

        }
      }, []);

    const handleSave = () => {
    let newPhotoTask;
    let isSuccess;
    
    if(taskID){
        newPhotoTask = new PhotoTask(taskID, displayName, dataLabel, instructions)
        isSuccess = updateTask(newPhotoTask);
    } else {
        let newTaskID = Date.now()
        newPhotoTask = new PhotoTask(newTaskID, displayName, dataLabel, instructions)
        isSuccess = addTask(newPhotoTask);
    }
    
    if (!isSuccess) {
        Alert.alert(
        "Error",
        "Duplicate dataLabel or taskDisplayName. Each task must have a unique dataLabel and taskDisplayName."
        );
        return;
    }
    
    // Only navigate away if the operation was successful
    navigation.navigate('SurveyBuilder');
    };

    // Change the title dynamically
    const nav = useNavigation();
    React.useLayoutEffect(() => {
        nav.setOptions({
            title: "New Photo Task", // Set the new title here
        });
    }, []);

    return (
        <View>
            <View>
                <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Display Name:</Text>
                </View>
                <TextInput
                    style={styles.textInput}
                    value={displayName}
                    onChangeText={setDisplayName}
                />
            </View>
            
            <View>
                <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Data Label:</Text>
                </View>
                <TextInput
                    style={styles.textInput}
                    value={dataLabel}
                    onChangeText={setDataLabel}
                />
            </View>
            <View>
                <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Instructions:</Text>
                </View>
                <TextInput
                    style={styles.textInput}
                    value={instructions}
                    onChangeText={setInstructions}
                />
            </View>
            <Button
                title="Save"
                onPress={handleSave}
            />
        </View>
    );
};

export default PhotoSetup;