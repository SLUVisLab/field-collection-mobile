import React, { createContext, useState, useContext, useEffect } from 'react';
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { basename } from 'path';

const SurveyDataContext = createContext();

export const SurveyDataProvider = ({ children }) => {
  // Define the initial state
  const initialState = {
    ID: null,
    surveyComplete: false,
    surveyName: null,
    startTime: null,
    stopTime: null,
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

  const addObservation = (data, item, collection, survey) => {
    let newObservation = data;

    newObservation["ID"] = uuidv4();
    newObservation["itemName"] = item.name;
    newObservation["itemID"] = item.ID;
    newObservation["collectionName"] = collection.name;
    newObservation["collectionID"] = collection.ID;
    newObservation["timestamp"] = Date.now();
    if (collection.parent) {
      newObservation["parentCollection"] = collection.parent;
    }
    newObservation["surveyName"] = survey.name;
    // newObservation["surveyID"] = survey.ID; //implement me

    console.log("New Observation: ", newObservation)

    setSurveyData((prevData) => {
      // Check if an observation for this item already exists
      const existingIndex = prevData.observations.findIndex(obs => obs.itemID === item.ID);

      if (existingIndex !== -1) {
          // If it exists, update it
          const updatedObservations = [...prevData.observations];
          updatedObservations[existingIndex] = newObservation;
          return { ...prevData, observations: updatedObservations };
      } else {
          // If it doesn't exist, add it
          return { ...prevData, observations: [...prevData.observations, newObservation] };
      }
    });

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
    console.log(itemID);
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

  const newSurvey = (surveyDesign) => {
    clearSurveyData();
    
    let newId = uuidv4();
    setID(newId);
    setName(surveyDesign.name)

    for(task of surveyDesign.tasks) {
      addTask[task]
    }
    
    setStartTime(Date.now())
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
      console.log("Loading survey from: ")

      console.log(`@surveyData_${surveyName.replace(/\s/g, '_')}`)
      //TODO: This throws an error when opening a new survey. Because name is null 

      const jsonValue = await AsyncStorage.getItem(`@surveyData_${surveyName.replace(/\s/g, '_')}`)
      
      console.log("loading stashed survey...")

      if (jsonValue != null) {
        const parsedValue = JSON.parse(jsonValue);
        // Check if the survey is incomplete
        if (parsedValue.surveyComplete === false) {
          return parsedValue;
        }
      }
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

  const saveForUpload = async () => {
    if (surveyData && surveyData.surveyName) {
      try {
        const jsonValue = JSON.stringify(surveyData)
        console.log("Saving survery to:")
        console.log(`@savedSurvey_${surveyData.surveyName.replace(/\s/g, '_')}_${Date.now()}`)
        await AsyncStorage.setItem(`@savedSurvey_${surveyData.surveyName.replace(/\s/g, '_')}_${Date.now()}`, jsonValue)
        console.log("saved survey data...")
      } catch (e) {
        // saving error
        console.log("Saved Failed: ")
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

  const uploadToStorage = async (path) => {
    try {

      const storage = getStorage();
      const projectRef = ref(storage, 'beta-group');
      const imagesRef = ref(projectRef, 'images');

      // strip everything but filename
      const fileName = basename(path);
      
      // create a reference in the storage server
      const fileRef = ref(imagesRef, path);

      

      const metadata = {
        contentType: 'image/jpeg'
      };


      

      // upload the file to the storage server


      const new_path =  "";
      return new_path;
    } catch (e) {
      console.log("Upload to Storage Failed: ");
      console.log(e);
    }

    return null;
  }

  const isMedia = (value) => {
     const mediaExtensions = ['.jpg', '.png', '.mp4', '.mp3'];
     
     if (typeof value === 'string' && mediaExtensions.some(ext => value.endsWith(ext))) {
        return true;
      }
      return false;
  }

  const handleMediaItems = async (survey) => {
    try {
      // Create a copy of the survey to avoid mutating the original object
      const newSurvey = { ...survey };
  
      // Iterate over each observation
      for (let i = 0; i < newSurvey.observations.length; i++) {
        const observation = newSurvey.observations[i];
  
        // Check each key/value pair
        for (const key in observation) {
          if (observation.hasOwnProperty(key)) {
            const value = observation[key];
  
            // If the value is a media item
            if (isMedia(value)) {
              // Upload the file to the firebase storage server
              const url = await uploadToStorage(value);
  
              // Replace the file path in the observation with the new url
              observation[key] = url;
            }
          }
        }
      }
  
      return newSurvey;
    } catch (e) {
      console.log("Handle Media Failed: ");
      console.log(e);
    }
  
    return null;
  }

  const uploadSurvey = async (storageKey) => {
    console.log("called upload survey");
    console.log(storageKey);
  
    try {
      // Get the survey data from storage
      const jsonValue = await AsyncStorage.getItem(storageKey);
      const surveyData = JSON.parse(jsonValue);
  
      console.log(surveyData);

      const newSurvey = handleMediaItems(surveyData);

      console.log(newSurvey);

      // upload the files to the firebase storage server
      // replace the file path in the observation with the new url
  
      // make sure the survey object is in the correct format for the mongodb server
  
      // upload the survey object to the mongodb server
    } catch (e) {
      console.log("Upload Survey Failed: ");
      console.log(e);
    }
  }

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

      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => useContext(SurveyDataContext);