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
        //TODO: Make real ID's
        
        if(taskID){
            // Update existing task in the survey context
            newPhotoTask = new PhotoTask(taskID, displayName, dataLabel, instructions)
            updateTask(newPhotoTask)

        } else {
            // Add new task to the survey context
            let newTaskID = Date.now()
            newPhotoTask = new PhotoTask(newTaskID, displayName, dataLabel, instructions)
            addTask(newPhotoTask)
        }

        //return to the survey builder page
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
                <Text>Display Name:</Text>
                <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                />
            </View>
            
            <View>
                <Text>Data Label:</Text>
                <TextInput
                    value={dataLabel}
                    onChangeText={setDataLabel}
                />
            </View>
            <View>
                <Text>Instructions:</Text>
                <TextInput
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