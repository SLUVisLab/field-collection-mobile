import React, { createContext, useState, useContext } from 'react';
import Task from '../tasks/Task'
import SurveyCollection from '../utils/SurveyCollection';
import SurveyItem from '../utils/SurveyItem';

const SurveyDesignContext = createContext();

export const SurveyDesignProvider = ({ children }) => {
  // Define the initial state
  const initialState = {
    name: null,
    lastSubmitted: null,
    collections: [],
    tasks: []
  };

  // Define state to hold the survey design
  const [surveyDesign, setSurveyDesign] = useState(initialState);

  // Method to clear the survey design state
  const clearSurveyDesign = () => {
    setSurveyDesign(initialState);
  };

  // Set survey name
  const setName = (name) => {
    if (typeof name === 'string') {
      setSurveyDesign((prevData) => ({
        ...prevData,
        name: name
      }));
    } else {
      console.error("Invalid survey name. Only strings allowed")
    }
  };

  // Add Task to survey
  const addTask = (newTask) => {
    if (newTask instanceof Task) {
      let isDuplicate;
      setSurveyDesign((prevData) => {
        isDuplicate = prevData.tasks.some(task => 
          task.dataLabel === newTask.dataLabel || task.taskDisplayName === newTask.taskDisplayName
        );
  
        if (isDuplicate) {
          console.error("Duplicate dataLabel or taskDisplayName. Each task must have a unique dataLabel and taskDisplayName.");
          return prevData;
        }
  
        return {
          ...prevData,
          tasks: [...prevData.tasks, newTask]
        };
      });
      return !isDuplicate;
    } else {
      console.error("Invalid task type. Only instances of type Task are accepted.");
      return false;
    }
  };

  // Update Task in survey
  const updateTask = (updatedTask) => {
    if (updatedTask instanceof Task) {
      let isDuplicate;
      setSurveyDesign((prevData) => {
        isDuplicate = prevData.tasks.some(task =>
          task.taskID !== updatedTask.taskID && 
          (task.dataLabel === updatedTask.dataLabel || task.taskDisplayName === updatedTask.taskDisplayName)
        );
  
        if (isDuplicate) {
          console.error("Duplicate dataLabel or taskDisplayName. Each task must have a unique dataLabel and taskDisplayName.");
          return prevData;
        }
  
        return {
          ...prevData,
          tasks: prevData.tasks.map(task =>
            task.taskID === updatedTask.taskID ? updatedTask : task
          )
        };
      });
      return !isDuplicate;
    } else {
      console.error("Invalid task type. Only instances of type Task are accepted.");
      return false;
    }
  };

  const getTaskByID = (taskID) => {
    const task = surveyDesign.tasks.find(task => task.taskID === taskID);
    return task !== undefined ? task : null;
  }

  // Add Collection to survey
  const addCollection = (newCollection) => {
    if (newCollection instanceof SurveyCollection) {
      setSurveyDesign((prevData) => ({
        ...prevData,
        collections: [...prevData.collections, newCollection]
      }));
    } else {
      console.error("Only instances of type Collection are accepted.");
    }
  };

  // Find collection by ID
  const findCollectionByID = (id) => {
    // Define a recursive function to search for the collection by ID
    const searchCollection = (collections) => {
      for (const collection of collections) {
        // Check if the current collection ID matches the provided ID
        if (collection.ID === id) {
          return collection;
        }
        // If the current collection has subcollections, recursively search them
        if (collection.subCollections && collection.subCollections.length > 0) {
          const foundCollection = searchCollection(collection.subCollections);
          if (foundCollection) {
            return foundCollection;
          }
        }
      }
      // If no matching collection is found, return null
      return null;
    };
  
    // Start the search from the top-level collections in surveyDesign
    return searchCollection(surveyDesign.collections);
  };

  // Add collection to subcollections array by parent ID
  const addNestedCollectionByID = (parentID, newCollection) => {

    console.log("Adding subcollection to:")
    console.log(parentID)

    const parentCollection = findCollectionByID(parentID);
    if (parentCollection) {
      parentCollection.subCollections.push(newCollection);
      setSurveyDesign({ ...surveyDesign });
    } else {
      console.error("Parent collection not found");
    }
  };

  // Add item to collections array by parent ID
  const addItemToCollection = (parentID, newItem) => {
    const parentCollection = findCollectionByID(parentID);
    if (parentCollection) {
      parentCollection.items.push(newItem);
      setSurveyDesign({ ...surveyDesign });
    } else {
      console.error("Parent collection not found");
    }
  };


  return (
    <SurveyDesignContext.Provider 
      value={{
          surveyDesign,
          setSurveyDesign,
          setName,
          addTask,
          updateTask,
          getTaskByID,
          addCollection,
          findCollectionByID,
          addNestedCollectionByID,
          addItemToCollection,
          clearSurveyDesign 
      }}
    >
      {children}
    </SurveyDesignContext.Provider>
  );
};

export const useSurveyDesign = () => useContext(SurveyDesignContext);