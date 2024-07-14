import React, { createContext, useState, useContext } from 'react';
import Task from '../tasks/Task'
import SurveyCollection from '../utils/SurveyCollection';
import SurveyDesign from '../models/SurveyDesign';
import {BSON} from 'realm';

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
  };

  // Update Task in survey
  const updateTask = (updatedTask) => {
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
      newCollection.parent = parentCollection.ID;
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

  const deleteTaskByID = (taskID) => {
    console.log("Deleting task with ID: " + taskID);
    const updatedTasks = surveyDesign.tasks.filter(task => task.taskID !== taskID);

    const newSurveyDesign = {
      ...surveyDesign,
      tasks: updatedTasks, // Explicitly update the tasks array
    };
    setSurveyDesign(newSurveyDesign);
    console.log("Task deleted");

  };
  

  const deleteCollectionByID = (collectionID) => {
    const deleteCollectionRecursive = (id, collections) => {
      return collections.map(collection => {
        // If the current collection has subCollections, check them for the target ID
        if (collection.subCollections) {
          collection.subCollections = deleteCollectionRecursive(id, collection.subCollections);
        }
        return collection;
      }).filter(collection => collection.ID !== id); // Now, filter the collection itself if it matches the ID
    };
  
    surveyDesign.collections = deleteCollectionRecursive(collectionID, surveyDesign.collections);
    setSurveyDesign({ ...surveyDesign });
  };
  
  // Delete an item from a collection by item ID
  const deleteItemFromCollection = (parentID, itemID) => {
    const parentCollection = findCollectionByID(parentID);
    if (parentCollection) {
      parentCollection.items = parentCollection.items.filter(item => item.ID !== itemID);
      setSurveyDesign({ ...surveyDesign });
    } else {
      console.error("Parent collection not found");
    }
  };

  const saveSurveyDesign = async (realm) => {
    return new Promise(async (resolve, reject) => {


      // TODO: Clean this up somehow!
      // Realm will save generic javascript objects in collections of mixed data types
      // However, it will not accept objects that are instances of custom classes.
      // We need to convert the custom class instances to plain objects before saving
      // and then convert them back to instances when loading the data.
      // We also have to store the typeID of the class instance so we can recreate the instance

      const tasksJSONArr = JSON.stringify(surveyDesign['tasks']);
      const tasksObjArr = JSON.parse(tasksJSONArr);

      if(tasksObjArr.length === surveyDesign['tasks'].length) {
        console.log("Tasks are the same")
        for (let i = 0; i < tasksObjArr.length; i++) {
          tasksObjArr[i]["typeId"] = surveyDesign['tasks'][i].constructor.typeID
        }
      } else {
        console.log("Tasks are different, aborting save")
        reject(error);
      }

      const collectionsJSONArr = JSON.stringify(surveyDesign['collections']);
      const collectionsObjArr = JSON.parse(collectionsJSONArr);

      try {
        realm.write(() => {
          realm.create('SurveyDesign', {
            _id: new BSON.ObjectId(),
            name: surveyDesign["name"],
            tasks: tasksObjArr,
            collections: collectionsObjArr
          });
        });

        resolve();

      } catch (error) {
        console.error("Error saving survey design: ", error);
        reject(error);
      }
    });
  };

  return (
    <SurveyDesignContext.Provider 
      value={{
          surveyDesign,
          setSurveyDesign,
          saveSurveyDesign,
          setName,
          addTask,
          updateTask,
          deleteTaskByID,
          deleteCollectionByID,
          deleteItemFromCollection,
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