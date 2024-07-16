import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
// import taskManifest from '../tasks/taskManifest'; // Import task manifest
import PhotoTask from '../tasks/photo/PhotoTask';
import TextTask from '../tasks/text/TextTask';


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
    <View>
      {tasks.map((taskModule, index) => (
        <TouchableOpacity
          key={index}
          style={localStyles.taskButton}
          // dont pass a taskID to the task setup view because this is a new task
          onPress={() => navigation.navigate('TaskSetup', { taskTypeID: taskModule.typeID, taskID: null }) }
        >
          {React.createElement(taskModule.typeIcon, { style: localStyles.taskIcon, size: 50 })}
          <View style = {localStyles.info}>
            <Text style={localStyles.taskName}>{taskModule.typeDisplayName}</Text>
            <Text style = {localStyles.taskDescription}>{taskModule.typeDescription}</Text>
          </View>
          
          
        </TouchableOpacity>
      ))}
    </View>
  );
};

const localStyles = StyleSheet.create({
  info: {
    flexDirection: 'column'
  },
  taskButton: {
    backgroundColor: 'white',
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1, // This will add a 1 pixel border to the bottom
    borderBottomColor: 'black', // This will make the border color black
  },
  taskName: {
    fontWeight: 'bold',
    fontSize: 20,
    marginLeft: 10,
  },
  taskDescription: {
    marginLeft: 10,
  },
  taskIcon: {
    justifyContent: 'center',
  },
});

export default TaskSelector;