import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import TaskManifest from '../tasks/TaskManifest';

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

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const taskTypeID = task.constructor.typeID;
    const taskID = task.taskID;
    const TaskComponent = TaskManifest[taskTypeID]?.taskAction;

    const fadeIn = () => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    };

    const fadeOut = (callback) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
        }).start(() => {
            if (callback) callback();
        });
    };

    useEffect(() => {
        // all items in this collection have been completed
        if (currentItemIndex >= collection.items.length) {
            navigation.push('CollectionList', { collectionID: collectionID });
        // or they havent. move to next item. index incremented elsewhere
        } else {
            fadeOut(() => {
                setCurrentItem(collection.items[currentItemIndex]);
                fadeIn();
            });
        }
    }, [currentItemIndex]);

    useEffect(() => {
        fadeIn();
    }, []);

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
        if (task) {
            navigation.setOptions({
            title: task.taskDisplayName || task.constructor.typeDisplayName
            });
        }
    }, [task]);

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
        console.log("SAVING OBSERVATION")
        addObservation(observationData, currentItem, collection, surveyDesign);

        //clear the observation data object for the next item.
        setObservationData({});

    }
    

    let renderedComponent;


    if (TaskComponent) {
        renderedComponent = (
            <TaskComponent
                key={taskID}
                existingData={observationData}
                task={task}
                onComplete={(data) => taskCompleted(data)}
                item={currentItem}
                collection={collection}
            />
        );
    } else {
        renderedComponent = <Text>Error Loading Component</Text>;
    }

    return (
        <Animated.View style={{ height: '100%', opacity: fadeAnim }}>
            {renderedComponent}
        </Animated.View>
    );
};

export default TaskAction;