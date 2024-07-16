import React from 'react';
import { View, Text } from 'react-native';
import TaskManifest from '../tasks/TaskManifest';

const TaskSetup = ({ route, navigation }) => {

    const {taskTypeID, taskID} = route.params

    console.log(taskTypeID)
    console.log(taskID)

    const TaskComponent = TaskManifest[taskTypeID]?.taskSetup;

    const renderedComponent = TaskComponent ? (
        <TaskComponent navigation={navigation} taskID={taskID} />
    ) : (
        <Text>Error Loading Component</Text>
    );

    return (
        <View>
            {renderedComponent}
        </View>
    );
};

export default TaskSetup;