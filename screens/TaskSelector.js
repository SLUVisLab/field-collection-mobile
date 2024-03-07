import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import taskManifest from '../tasks/taskManifest'; // Import task manifest
import PhotoTask from '../tasks/photo/PhotoTask'
import TextTask from '../tasks/text/TextTask'


const TaskSelector = ({ navigation }) => {
  const [taskModules, setTaskModules] = useState([]);

  const tasks = [PhotoTask, TextTask];

  // this is currently not working. Dynamic importing of task modules.
  // TODO: Fix me later
  // useEffect(() => {
  //   const importTaskModules = async () => {
  //     try {
  //       const importedModules = await Promise.all(
  //         modules.map(task => import(task))
  //       );

  //       setTaskModules(importedModules);
  //     } catch (error) {
  //       console.error('Error importing task modules:', error);
  //     }
  //   };

  //   importTaskModules();
  // }, []);

  return (
    <View style={styles.container}>
      {tasks.map((taskModule, index) => (
        <TouchableOpacity
          key={index}
          style={styles.button}
          // dont pass a taskID to the task setup view because this is a new task
          onPress={() => navigation.navigate('TaskSetup', { taskTypeID: taskModule.typeID, taskID: null }) }
        >
          <Text style={styles.text}>{taskModule.typeDisplayName}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default TaskSelector;