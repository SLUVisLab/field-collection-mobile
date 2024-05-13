import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import PhotoAction from '../tasks/photo/PhotoAction';
import TextAction from '../tasks/text/TextAction';

import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';

const TaskAction = ({ route, navigation }) => {

    const {surveyDesign, getTaskByID, findCollectionByID} = useSurveyDesign();
    const { addObservation, getObservationByItemID } = useSurveyData()

    const {itemID, collectionID} = route.params;

    const collection = findCollectionByID(collectionID)

    const [currentItemIndex, setCurrentItemIndex] = useState(collection.items.findIndex(item => item.ID === itemID));
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [task, setTask] = useState(surveyDesign.tasks[currentTaskIndex]);
    const [currentItem, setCurrentItem] = useState(collection.items[currentItemIndex]);

    const [observationData, setObservationData] = useState({});

    useEffect(() => {
        // all items in this collection have been completed
        if (currentItemIndex >= collection.items.length) {
            navigation.push('CollectionList', { collectionID: collectionID });
        // or they havent. move to next item. index incremented elsewhere
        } else {
            setCurrentItem(collection.items[currentItemIndex]);
        }
    }, [currentItemIndex]);

    useEffect(() => {
        // all tasks for this item have been completed. move to the next item
        if (currentTaskIndex >= surveyDesign.tasks.length) {
            // save data for this item
            itemCompleted();

            setCurrentItemIndex(currentItemIndex + 1);
            setCurrentTaskIndex(0);

        // continue to the next task for this item (index has been incremented by onComplete function)
        } else {
            setTask(surveyDesign.tasks[currentTaskIndex]);
        }
    }, [currentTaskIndex]);

    useEffect(() => {
        console.log("Checking for existing data...")
        existingData = getObservationByItemID(currentItem.ID)
        if(existingData){
            console.log("Found existing data...")
            console.log(existingData)
            setObservationData(existingData)
        }
    }, [currentItem]);

    const taskCompleted = (data) => {

        // Add the new key-value pair to the object
        setObservationData(prevObservationData => ({
            ...prevObservationData,
            ...data
        }));

        setCurrentTaskIndex(currentTaskIndex + 1)
    }

    const itemCompleted = () => {
        //save the observatio data to the survey data context
        addObservation(observationData, currentItem, collection, surveyDesign);
        console.log("OBSERVATION RECEIVED")
        console.log(observationData)

        //clear the observation data object for the next item.
        setObservationData({});

    }

    let renderedComponent;
    const taskTypeID = task.constructor.typeID;
    const taskID = task.id;

    switch(taskTypeID){
        case 1:
            renderedComponent = <PhotoAction navigation = { navigation } existingData = { observationData} task = { task } onComplete={(data) => taskCompleted(data) } item={currentItem} collection={collection} />;
            break;
        case 2:
            renderedComponent = <TextAction navigation = { navigation } existingData = { observationData} task = { task } onComplete={(data) => taskCompleted(data) } item={currentItem} />;
            break;
        default:
            renderedComponent = <Text>Error Loading Component</Text>
    }

    return (
        <View style={{ height: '100%' }}>
            {renderedComponent}
        </View>
    );
};

export default TaskAction;