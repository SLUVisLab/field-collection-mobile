import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import styles from '../Styles';
import PhotoAction from '../tasks/photo/PhotoAction';
import TextAction from '../tasks/text/TextAction';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';

const TaskAction = ({ route, navigation }) => {

    const {surveyDesign, getTaskByID, findCollectionByID} = useSurveyDesign();

    const {itemID, collectionID} = route.params;

    const collection = findCollectionByID(collectionID)

    const [currentItemIndex, setCurrentItemIndex] = useState(collection.items.findIndex(item => item.ID === itemID));
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [task, setTask] = useState(surveyDesign.tasks[currentTaskIndex]);
    const [currentItem, setCurrentItem] = useState(collection.items[currentItemIndex]);

    useEffect(() => {
        if (currentItemIndex >= collection.items.length) {
            navigation.push('CollectionList', { collectionID: collectionID });
        } else {
            setCurrentItem(collection.items[currentItemIndex]);
        }
    }, [currentItemIndex]);

    useEffect(() => {
        if (currentTaskIndex >= surveyDesign.tasks.length) {
            setCurrentItemIndex(currentItemIndex + 1);
            setCurrentTaskIndex(0);
        } else {
            setTask(surveyDesign.tasks[currentTaskIndex]);
        }
    }, [currentTaskIndex]);

    let renderedComponent;
    const taskTypeID = task.constructor.typeID;
    const taskID = task.id;

    switch(taskTypeID){
        case 1:
            renderedComponent = <PhotoAction navigation = { navigation } taskID = { taskID } onComplete={() => setCurrentTaskIndex(currentTaskIndex + 1)} itemName={currentItem.name} />;
            break;
        case 2:
            renderedComponent = <TextAction navigation = { navigation } taskID = { taskID } onComplete={() => setCurrentTaskIndex(currentTaskIndex + 1)} itemName={currentItem.name} />;
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

export default TaskAction;