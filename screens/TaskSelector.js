import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TaskManifest from '../tasks/TaskManifest'; // Import task manifest
import PhotoTask from '../tasks/photo/PhotoTask';
import TextTask from '../tasks/text/TextTask';


const TaskSelector = ({ navigation }) => {
  const [taskModules, setTaskModules] = useState([]);

  const tasks = [PhotoTask, TextTask];

  return (
    <View>
      {Object.keys(TaskManifest).map((key, index) => {
        const taskModule = TaskManifest[key].taskModule;

        return (
          <TouchableOpacity
            key={index}
            style={localStyles.taskButton}
            onPress={() => navigation.navigate('TaskSetup', { taskTypeID: taskModule.typeID, taskID: null })}
          >
            {React.createElement(taskModule.typeIcon, { style: localStyles.taskIcon, size: 50 })}
            <View style={localStyles.info}>
              <Text style={localStyles.taskName}>{taskModule.typeDisplayName}</Text>
              <Text style={localStyles.taskDescription}>{taskModule.typeDescription}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const localStyles = StyleSheet.create({
  info: {
    flexDirection: 'column',

  },
  taskButton: {
    backgroundColor: 'white',
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1, 
    borderBottomColor: 'black', 
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
    width: 60, // fixed width helps with slightly different icon sizes
  },
});

export default TaskSelector;