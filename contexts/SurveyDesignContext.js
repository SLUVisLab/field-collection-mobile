import React, { createContext, useState, useContext } from 'react';
import Task from '../tasks/Task'
import TaskManifest from '../tasks/TaskManifest';
import SurveyCollection from '../utils/SurveyCollection';
import SurveyDesign from '../models/SurveyDesign';
import {BSON} from 'realm';
import SurveyItem from '../utils/SurveyItem';
import { id } from 'date-fns/locale';

const SurveyDesignContext = createContext();

export const SurveyDesignProvider = ({ children }) => {
  // Define the initial state
  const initialState = {
    id: null,
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
      // which, looking at it again, is a bit of a mess.

      const tasksJSONArr = JSON.stringify(surveyDesign['tasks']);
      const tasksObjArr = JSON.parse(tasksJSONArr);

      if(tasksObjArr.length === surveyDesign['tasks'].length) {
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
          if (surveyDesign.id) {
            console.log("Updating existing survey design")
            const existingSurvey = realm.objectForPrimaryKey('SurveyDesign', surveyDesign.id);

            if (existingSurvey) {
              console.log("Existing survey found in mongo")
              existingSurvey.name = surveyDesign["name"];
              existingSurvey.tasks = tasksObjArr;
              existingSurvey.collections = collectionsObjArr;
            }

          } else {
            console.log("Creating new survey design")
            realm.create('SurveyDesign', {
              _id: new BSON.ObjectId(),
              name: surveyDesign["name"],
              tasks: tasksObjArr,
              collections: collectionsObjArr
            });
          }
        });

        resolve();

      } catch (error) {
        console.error("Error saving survey design: ", error);
        reject(error);
      }
    });
  };

  const surveyFromMongo = async (mongoDesign) => {

    const newDesign = {
      id: mongoDesign._id,
      name: mongoDesign.name,
      tasks: [],
      collections: []
    };

    for (const collection of mongoDesign.collections) {
      // console.log("Parsing base level collection....")
      let newCollection = new SurveyCollection({
        name: collection.name,
        id: collection._id
      });
      
      if(collection.items.length > 0) {
        // console.log("Items found....")
        for (const item of collection.items) {

          console.log("creating new instance of item...")
          newItem = new SurveyItem({
            name: item.name,
            id: item.ID,
            labels: item.labels,
            location: item.location,
            collectionId: item.collectionId
          });
          console.log("New Item ID:", newItem.ID)
          console.log("Source Item ID:", item.ID)

          newCollection.addItem(newItem);
        }

      } else if (collection.subCollections.length > 0) {
        // console.log("subcollection found....")
        console.log(collection.subCollections)
        for (const subCollection of collection.subCollections) {
          newSubCollection = new SurveyCollection({
            name: subCollection.name,
            id: subCollection._id,
            parentName: collection.name,
            parentId: collection._id
          });

          if(subCollection.items.length > 0) {
            // console.log("sub Items found....")
            // console.log(subCollection.items)
            for (const item of subCollection.items) {
              newItem = new SurveyItem({
                name: item.name,
                id: item._id,
                labels: item.labels,
                location: item.location,
                collectionId: item.collectionId
            });
              newSubCollection.addItem(newItem);
            }
          }
          newCollection.addSubcollection(newSubCollection);

        }
      } else {
        // there are no tasks or subcollections
        console.log("No items or subcollections found")
      }

      console.log(newCollection)

      newDesign.collections.push(newCollection);
    }

    for (const task of mongoDesign.tasks) {
      // console.log("Parsing task....")

      let newTask = new TaskManifest[task.typeId].taskModule(
        task.taskID,
        task.taskDisplayName,
        task.dataLabel,
        task.instructions
      );

      newDesign.tasks.push(newTask);
    }

    setSurveyDesign({
      ...newDesign,
      });

  }

  return (
    <SurveyDesignContext.Provider 
      value={{
          surveyDesign,
          setSurveyDesign,
          saveSurveyDesign,
          surveyFromMongo,
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