import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from '../../Styles';
import PhotoTask from './PhotoTask';
import { useSurveyDesign } from '../../contexts/SurveyDesignContext';

const PhotoSetup = ({navigation, taskID}) => {

    // initialize the survey desgin context
    const { surveyDesign, setName, addTask, updateTask, getTaskByID, deleteTask } = useSurveyDesign();

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

    const validateFields = () => {
        const newErrors = {};
        if (!displayName) newErrors.displayName = 'Display Name cannot be empty';
        if (!dataLabel) newErrors.dataLabel = 'Data Label cannot be empty';
        if (!instructions) newErrors.instructions = 'Instructions cannot be empty';
        return newErrors;
    };

    const handleSave = () => {

        const validationErrors = validateFields();
        if (Object.keys(validationErrors).length > 0) {
            Alert.alert(
                "Please fix the following errors:",
                Object.values(validationErrors).join('\n')
            );
            return;
        }
        
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
            "Duplicate Data Label or Display Name. Each task must have a unique Data Label and Display Name."
            );
            return;
        }
    
        // Only navigate away if the operation was successful
        navigation.navigate('SurveyBuilder');
    };

    const handleDelete = () => {
        deleteTask(taskID);
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
            <TouchableOpacity
                style={styles.button}
                onPress={handleSave}
            >
                <Text style={styles.text}>Save</Text>
            </TouchableOpacity>
            {taskID && (
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleDelete}
                >
                    <Text style={styles.text}>Delete</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default PhotoSetup;