import React, { createContext, useState, useContext, useEffect } from 'react';
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {storage, auth} from '../firebase';
import * as FileSystem from 'expo-file-system';

// import {useRealm} from '@realm/react';
import {BSON} from 'realm';

// import Observation from '../models/Observation';
// import SurveyResults from '../models/SurveyResults';
import TaskManifest from '../tasks/TaskManifest';

import { getFileExtensionFromPathOrBlob, generateDescriptiveFilename, isMedia } from '../utils/mediaUtils';

const SurveyDataContext = createContext();

const MAX_ITEM_ID_LENGTH = 10; // arbitrary cap to prevent filenames from being unwieldy

export const SurveyDataProvider = ({ children }) => {
  // Define the initial state
  const initialState = {
    ID: null,
    surveyComplete: false,
    surveyName: null,
    startTime: null,
    stopTime: null,
    user: null,
    tasks: [],
    collections: [],
    observations: []
  };

  // Define state to hold the survey design
  const [surveyData, setSurveyData] = useState(initialState);

  // Method to clear the survey design state
  const clearSurveyData = () => {
    setSurveyData(initialState);
  };

  // Set survey name
  const setName = (name) => {
    setSurveyData((prevData) => ({
    ...prevData,
    surveyName: name
    }));
  };

  const setID = (id) => {
    setSurveyData((prevData) => ({
        ...prevData,
        ID: id
    }));
  }

  const setSurveyComplete = (bool) => {
    setSurveyData((prevData) => ({
    ...prevData,
    surveyComplete: bool
    }));
  };

  const setStartTime = (dt) => {
    setSurveyData((prevData) => ({
    ...prevData,
    startTime: dt
    }));
  };

  const setStopTime = (dt) => {

    console.log("Setting stop time: " + dt)
    setSurveyData((prevData) => ({
    ...prevData,
    stopTime: dt
    }));
  };

  const addObservation = (data, item, collection, survey) => {
    let newObservation = {};

    newObservation["data"] = data;
    newObservation["ID"] = uuidv4();
    newObservation["itemName"] = item.name;
    newObservation["itemID"] = item.ID;
    newObservation["collectionName"] = collection.name;
    newObservation["collectionID"] = collection.ID;
    newObservation["parentCollectionName"] = collection.parentName ? collection.parentName : null;
    newObservation["parentCollectionID"] = collection.parentId ? collection.parentId : null; 
    newObservation["timestamp"] = Date.now();
    newObservation["surveyName"] = survey.name;
    // newObservation["surveyID"] = survey.ID; //implement me

    console.log("New Observation: ", newObservation)
    console.log("Observations: ", surveyData.observations)

    setSurveyData((prevData) => {
      // Check if an observation for this item already exists
      const existingIndex = prevData.observations.findIndex(obs => obs.itemID === item.ID);

      if (existingIndex !== -1) {
        // If it exists, update it
        console.log("Updating existing observation...")
        const updatedObservations = [...prevData.observations];
        updatedObservations[existingIndex] = newObservation;
        return { ...prevData, observations: updatedObservations };
      } else {
        console.log("Adding new observation...")
        // If it doesn't exist, add it
        return { ...prevData, observations: [...prevData.observations, newObservation] };
      }

      
    });

    console.log("Observations: ", surveyData.observations)

  };

  //TODO: Does this get used?
  const updateObservation = (updatedObs) => {
    setSurveyData((prevData) => ({
    ...prevData,
    observations: prevData.observations.map(obs =>
        obs.id === updatedObs.id ? updatedObs : obs
    )
    }));
  };

  const getObservationByItemID = (itemID) => {
    const observation = surveyData.observations.find(obs => obs.itemID === itemID);
    print("Get observation by ID=: " + observation )
    return observation !== undefined ? observation : null;
  }

  const itemHasObservation = (itemID)=> {
    console.log(surveyData)
    console.log(surveyData.observations)
    console.log("ITEM ID FOR SEARCH:")
    console.log(itemID)
    for(const thing of surveyData.observations) {
      console.log("Observation: " + thing.itemID)
      console.log(typeof thing)
    }
    console.log("Checking if item has observation: " + itemID)
    const observation = surveyData.observations.find(obs => obs.itemID === itemID);
    console.log("Item has observation: " + observation)
    return observation !== undefined ? true : false;
  }

  // Add Collection to survey
  const addCollection = (newCollection) => {
    setSurveyData((prevData) => ({
    ...prevData,
    collections: [...prevData.collections, newCollection]
    }));
  };

  const addTask = (newTask) => {
    setSurveyData((prevData) => ({
    ...prevData,
    tasks: [...prevData.tasks, newTask]
    }));
  };

  const newSurvey = (mongoDesign) => {
    console.log("NEW SURVEY DATA INSTANCE")
    clearSurveyData();
    
    let newId = uuidv4();
    setID(newId);
    console.log("creating new survey with name: " + mongoDesign.name)
    setName(mongoDesign.name)
    console.log("survey name " + surveyData.name) // returns undefined bc lifecycle update is async

    for(const task of mongoDesign.tasks) {

      let newTask = new TaskManifest[task.typeId].taskModule(
        task.taskID,
        task.taskDisplayName,
        task.dataLabel,
        task.instructions,
        task.options
      );

      addTask(newTask);
    }
    
    setStartTime(Date.now());
  
    //TODO: Handle Collections
    // Keep in mind -- what about future surveys that dont have predefined collections?
    // would it be better to wait until survey submission to include these?

  }

  const stashForLater = async (surveyData) => {
    if (surveyData && surveyData.surveyName) {
      try {
        const jsonValue = JSON.stringify(surveyData)
        console.log("Saving survery to:")
        console.log(`@surveyData_${surveyData.surveyName.replace(/\s/g, '_')}`)
        await AsyncStorage.setItem(`@surveyData_${surveyData.surveyName.replace(/\s/g, '_')}`, jsonValue)
        console.log("saved progress..")
      } catch (e) {
        // saving error
        console.log("Stash For Later Failed: ")
        console.log(e);
      }
    }
  }

  // Save the survey data whenever it changes
  useEffect(() => {

    stashForLater(surveyData);
  }, [surveyData.observations]);


  // Should only load surveys that don't have surveyComplete set to true
  const loadFromStash = async (surveyName) => {
    try {
      console.log("checking for survey from: ")

      console.log(`@surveyData_${surveyName.replace(/\s/g, '_')}`)
      //TODO: This throws an error when opening a new survey. Because name is null 

      const jsonValue = await AsyncStorage.getItem(`@surveyData_${surveyName.replace(/\s/g, '_')}`)

      if (jsonValue != null) {
        console.log("stashed survey found...")  
        const parsedValue = JSON.parse(jsonValue);
        // Check if the survey is incomplete
        if (parsedValue.surveyComplete === false) {
          return parsedValue;
        }
      }
      console.log("No stashed survey found...")
      return null;
      
    } catch(e) {
      // loading error
      console.log("Load From Stash Failed: ")
      console.log(e);
    }
  }

  const deleteFromStash = async (surveyName) => {
    try {
      console.log("Deleting survey from stash: ");
      console.log(`@surveyData_${surveyName.replace(/\s/g, '_')}`);
      await AsyncStorage.removeItem(`@surveyData_${surveyName.replace(/\s/g, '_')}`);
      console.log("Deleted stashed survey...");
    } catch(e) {
      // deletion error
      console.log("Delete From Stash Failed: ");
      console.log(e);
    }
  }

  const saveForUpload = async (surveyDesign, user) => {

    console.log("SAVING FOR UPLOAD...") 
    console.log(surveyData)
    console.log(surveyData.surveyName)
    if (surveyData && surveyData.surveyName) {
      console.log("processing survey...")
      try {
        surveyData.user = user;
        surveyData.collections = [...surveyDesign.collections];
        surveyData.tasks = [...surveyDesign.tasks];
        surveyData.surveyComplete = true;
        surveyData.stopTime = Date.now();
      } catch(e) {
        console.log("Failed to process survey: ", e);
      }

      try {
        const jsonValue = JSON.stringify(surveyData)
        console.log("Saving survery to:")
        console.log(`@savedSurvey_${surveyData.surveyName.replace(/\s/g, '_')}_${Date.now()}`)
        await AsyncStorage.setItem(`@savedSurvey_${surveyData.surveyName.replace(/\s/g, '_')}_${Date.now()}`, jsonValue)
        console.log("saved survey data...")
      } catch (e) {
        // saving error
        console.log("Save Failed: ")
        console.log(e);
      }
    }
  }

  const listAllSavedSurveys = async () => {

    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
  
      // Filter keys related to saved surveys
      const surveyKeys = keys.filter(key => key.startsWith('@savedSurvey_'));
      
      // Get all saved survey data
      const results = await AsyncStorage.multiGet(surveyKeys);
  
      // Parse each saved survey data and extract the desired properties
      const savedSurveys = results.map(result => {
        const survey = JSON.parse(result[1]);
        return {
          key: result[0],
          surveyName: survey.surveyName,
          completed: survey.stopTime,
          count: survey.observations.length
        };
      });
  
      return savedSurveys;
    } catch(e) {
      // loading error
      console.log("List All Saved Surveys Failed: ")
      console.log(e);
    }
  }

  const deleteLocalMedia = async (mediaPaths) => {
    try {
      for (const path of mediaPaths) {
        await FileSystem.deleteAsync(path);
      }
      console.log("All media files have been successfully deleted.");
    } catch (e) {
      console.log("Delete Uploaded Media Failed: ", e);
    }
  }

  const deleteLocalSurveyData = async (storageKey) => {
    try {
      if (!storageKey) {
        console.log("Storage key is required.");
        return;
      }
  
      await AsyncStorage.removeItem(storageKey);
      console.log(`Survey data associated with ${storageKey} has been successfully deleted.`);

    } catch(e) { 
      // deletion error
      console.log(`Delete Uploaded Survey Failed for ${storageKey}: `, e);
    }
  }


  const uploadToMediaStorage = async (path, context = {}) => {
    if(auth.currentUser) {
      try {

        console.log("Uploading with context:", context);

        // get the image file
        const response = await fetch(path); //THIS IS WHERE THE ERROR IS
        const blob = await response.blob();

        const ext = getFileExtensionFromPathOrBlob(path, blob) || 'jpg';

        const fileName = generateDescriptiveFilename({
          parent: context.parentName,
          subcollection: context.subcollectionName,
          item: context.itemName,
          itemID: context.itemID,
          index: context.index,
          extension: ext,
        });

        console.log("Generated filename:", fileName);

        const projectRef = ref(storage, 'beta-group');
        const imagesRef = ref(projectRef, 'images');
  
        // create a reference in the storage server
        const fileRef = ref(imagesRef, fileName);
        
        const metadata = { contentType: blob.type || `image/${ext}` };

        const uploadTask = uploadBytesResumable(fileRef, blob, metadata);

        return new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload is ' + progress + '% done');
              switch (snapshot.state) {
                case 'paused':
                  console.log('Upload is paused');
                  break;
                case 'running':
                  console.log('Upload is running');
                  break;
              }
            }, 
            (error) => {
              // A full list of error codes is available at
              // https://firebase.google.com/docs/storage/web/handle-errors
              switch (error.code) {
                case 'storage/unauthorized':
                  console.log("Unauthorized: ", error.code)
                  // User doesn't have permission to access the object
                  reject(error);
                case 'storage/canceled':
                  // User canceled the upload
                  console.log("Canceled: ", error.code)
                  reject(error);
                case 'storage/unknown':
                  // Unknown error occurred, inspect error.serverResponse
                  console.log("Unknown: ", error.code)
                  reject(error);
              }
            }, 
            () => {
              // Upload completed successfully, now we can get the download URL
              getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('File uploaded');
                resolve(downloadURL);
              });
            }
          );
        });

      } catch (e) {
        console.log("Upload to Media Storage Failed: ");
        console.error(e);
        throw e;
      }
    } else {
      console.log('User is not authenticated. Cannot upload file.');
      throw new Error('User is not authenticated. Cannot upload file.');
    }
  }


  const handleMediaItems = async (survey) => {
    try {
      // Create a copy of the survey to avoid mutating the original object
      const processedSurvey = { ...survey };
      const localMediaPaths = [];
  
      // Iterate over each observation
      for (let i = 0; i < processedSurvey.observations.length; i++) {
        const observation = processedSurvey.observations[i];

        const data = observation.data;

        const context = {
          parentName: observation.parentCollectionName || '',
          subcollectionName: observation.collectionName || '',
          itemName: observation.itemName || '',
          itemID: (observation.itemID || '').substring(0, MAX_ITEM_ID_LENGTH),
        };
  
        // Check each key/value pair
        for (const key in data) {
          const value = data[key];
        
          if (Array.isArray(value) && value.every(isMedia)) {
            const urls = [];
            for (let j = 0; j < value.length; j++) {
              const uri = value[j];
              const url = await uploadToMediaStorage(uri, { ...context, index: j });
              localMediaPaths.push(uri);
              urls.push(url);
            }
            data[key] = urls;
          } else if (isMedia(value)) {
            const url = await uploadToMediaStorage(value, { ...context });
            localMediaPaths.push(value);
            data[key] = url;
          }
        }
      }

      console.log("New Survey: ", processedSurvey);

      return { processedSurvey, localMediaPaths };

    } catch (e) {
      console.log("Handle Media Failed: ");
      console.error(e);
      throw e;
    }
  }

  const uploadSurvey = async (storageKey, realm) => {
    return new Promise(async (resolve, reject) => {

      let mediaPaths;

      try {

        let isProcessing = false;
        // This listener will be called when the realm has been updated
        // It handles cleanup tasks after the survey has been uploaded
        realm.addListener('change', realmChangedListener = () => {
          console.log("REALM CHANGED");

          if (isProcessing) {
            console.log("Already processing. Skipping...");
            return;
          }

          isProcessing = true; // Prevent multiple calls to this listener

          const handleAsyncOperations = async () => {
            // Delete the uploaded media files
            await deleteLocalMedia(mediaPaths);
            
            // Delete the survey data from AsyncStorage
            await deleteLocalSurveyData(storageKey);
          };

          handleAsyncOperations().then(() => {
            realm.removeAllListeners();
            resolve("Survey uploaded successfully");
            isProcessing = false;
          }).catch((error) => {
            isProcessing = false;
            console.error("Error handling async operations: ", error);
            // Handle any errors that occurred during the async operations
          });

        });

      } catch (error) {
        console.error(
          `An exception was thrown within change listeners: ${error}`
        );
      }

      try {
        const jsonValue = await AsyncStorage.getItem(storageKey);
        const surveyData = JSON.parse(jsonValue);
        const {processedSurvey, localMediaPaths} = await handleMediaItems(surveyData);

        console.log(localMediaPaths);
        console.log(processedSurvey);

        mediaPaths = localMediaPaths;
        
        console.log("Uploading survey to Realm: ");
        console.log(processedSurvey['collections']);
        console.log(processedSurvey['tasks']);
        realm.write(() => {
          realm.create('SurveyResults', {
            _id: new BSON.ObjectId(),
            name: processedSurvey["surveyName"],
            dateStarted: new Date(processedSurvey["startTime"]),
            dateCompleted: new Date(processedSurvey["stopTime"]),
            user: processedSurvey["user"],
            tasks: processedSurvey["tasks"],
            collections: processedSurvey["collections"],
            observations: processedSurvey["observations"]
          });

        });

      } catch (error) {
        console.error("Upload Survey Failed:", error);
        realm.removeAllListeners();
        reject(error);
      }
    });
  }

  // Not currently in use. An attempt to fix async issues with loading survey data
  const quickLoadSurvey = (data) => {
    return new Promise((resolve, reject) => {
      try {
        if (surveyData) {
          console.log("Quick loading survey data...");
          console.log(data);
          surveyData.ID = data.ID;
          surveyData.surveyComplete = data.surveyComplete;
          surveyData.surveyName = data.surveyName;
          surveyData.startTime = data.startTime;
          surveyData.stopTime = data.stopTime;
          surveyData.user = data.user; 
          surveyData.tasks = data.tasks;
          surveyData.collections = data.collections;
          surveyData.observations = data.observations;

          console.log("survey data set")
  
          resolve("Survey data loaded successfully");
        } else {
          reject("Survey data is not defined");
        }
      } catch (e) {
        console.log("Quick Load Survey Failed: ");
        console.log(e);
        reject(e);
      }
    });
  };
  
  return (
    <SurveyDataContext.Provider 
      value={{
          surveyData,
          setSurveyData,
          clearSurveyData,
          setName,
          setID,
          setSurveyComplete,
          setStartTime,
          addObservation,
          updateObservation,
          getObservationByItemID,
          itemHasObservation,
          addCollection,
          addTask,
          newSurvey,
          loadFromStash,
          deleteFromStash,
          listAllSavedSurveys,
          saveForUpload,
          uploadSurvey,
          deleteLocalSurveyData,
          quickLoadSurvey

      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => useContext(SurveyDataContext);