import React from 'react';
import { View, Text } from 'react-native';
import styles from '../Styles';
import PhotoSetup from '../tasks/photo/PhotoSetup';
import TextSetup from '../tasks/text/TextSetup';

const TaskSetup = ({ route, navigation }) => {

    const {taskTypeID, taskID} = route.params

    let renderedComponent;

    console.log(taskTypeID)
    console.log(taskID)

    switch(taskTypeID){
        case 1:
            renderedComponent = <PhotoSetup navigation = { navigation } taskID = { taskID } />;
            break;
        case 2:
            renderedComponent = <TextSetup navigation = { navigation } taskID = { taskID } />;
            break;
        default:
            renderedComponent = <Text>Error Loading Component</Text>
    }

    return (
        <View>
            {renderedComponent}
        </View>
    );
};

export default TaskSetup;