import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useNavigation } from '@react-navigation/native';
import styles from '../Styles';
import TaskManifest from '../tasks/TaskManifest';

const TaskSetup = ({ route, navigation }) => {

    const {taskTypeID, taskID} = route.params

    const { addTask, updateTask, getTaskByID, deleteTaskByID } = useSurveyDesign();

    const [displayName, setDisplayName] = useState('');
    const [dataLabel, setDataLabel] = useState('');
    const [instructions, setInstructions] = useState('');
    const [options, setOptions] = useState({});

    const TaskComponent = TaskManifest[taskTypeID]?.taskSetup;
    const TaskInstance = TaskManifest[taskTypeID]?.taskModule;
    const typeDisplayName = TaskManifest[taskTypeID]?.taskModule.typeDisplayName;

    useEffect(() => {
        // Fetch task data based on taskID
        if (taskID) {
          //Get existing task data
          const existingTask = getTaskByID(taskID)
          
          if(existingTask){
            setDisplayName(existingTask.taskDisplayName)
            setDataLabel(existingTask.dataLabel)
            setInstructions(existingTask.instructions)
            setOptions(existingTask.options)
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
        
        //TODO: Make real ID's
        let isSuccess;
        let newTask;
        
        if(taskID){
            console.log("Saving Options: ", options);
            // Update existing task in the survey context
            newTask = new TaskInstance(taskID, displayName, dataLabel, instructions, options);
            console.log("New Task Options: ", newTask.options);
            isSuccess = updateTask(newTask);

        } else {
            // Add new task to the survey context
            console.log("Saving Options: ", options);
            let newTaskID = Date.now()
            newTask = new TaskInstance(newTaskID, displayName, dataLabel, instructions, options);
            console.log("New Task Options: ", newTask.options);
            isSuccess = addTask(newTask);
        }

        if (!isSuccess) {
            Alert.alert(
            "Error",
            "Duplicate Data Label or Display Name. Each task must have a unique Data Label and Display Name."
            );
            return;
        }

        //return to the survey builder page
        navigation.navigate('SurveyBuilder');

    };

    const handleDelete = () => {
        deleteTaskByID(taskID);
        navigation.navigate('SurveyBuilder');
    };

    // Change the title dynamically
    const nav = useNavigation();
    React.useLayoutEffect(() => {
        nav.setOptions({
            title: `New ${typeDisplayName} Task`, // Set the new title here
        });
    }, [typeDisplayName]);


    const optionsComponent = TaskComponent ? (
        <TaskComponent options={options} setOptions={setOptions} />
    ) : (
        <Text>Error Loading Component</Text>
    );

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
                    autoCorrect={false}
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
                    autoCorrect={false}
                    autoCapitalize="none"
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
                    autoCorrect={false}
                />
            </View>
            <View>
                {optionsComponent}
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

export default TaskSetup;