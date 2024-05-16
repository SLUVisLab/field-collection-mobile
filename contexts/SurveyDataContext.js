import React, { createContext, useState, useContext, useEffect } from 'react';
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SurveyDataContext = createContext();

export const SurveyDataProvider = ({ children }) => {
  // Define the initial state
  const initialState = {
    ID: null,
    surveyInProgress: false,
    surveyName: null,
    startTime: null,
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

  const setInProgress = (bool) => {
    setSurveyData((prevData) => ({
    ...prevData,
    surveyInProgress: bool
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

    // setSurveyData((prevData) => ({
    // ...prevData,
    // observations: [...prevData.observations, newObservation]
    // }));
  };

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

    setInProgress(true)
    console.log("NEW SURVEY NAMED: ")
    console.log(surveyDesign.name)
    setName(surveyDesign.name)
    
    setStartTime(Date.now())
    //TODO: Handle Collections and Tasks
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
        console.log("STASH FOR LATER")
        console.log(e);
      }
    }
  }

    // Save the survey data whenever it changes
    useEffect(() => {
      console.log("Calling Stash For Later")
      stashForLater(surveyData);
    }, [surveyData.observations]);

  const loadFromStash = async (surveyName) => {
    try {
      console.log("Loading survey from: ")

      console.log(`@surveyData_${surveyName.replace(/\s/g, '_')}`)
      //TODO: This throws an error when opening a new survey. Because name is null 

      const jsonValue = await AsyncStorage.getItem(`@surveyData_${surveyName.replace(/\s/g, '_')}`)
      
      console.log("loading stashed survey...")
      return jsonValue != null ? JSON.parse(jsonValue) : null;
      

    } catch(e) {
      // loading error
      console.log("LOAD FROM STASH")
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
          setInProgress,
          setStartTime,
          addObservation,
          updateObservation,
          getObservationByItemID,
          itemHasObservation,
          addCollection,
          addTask,
          newSurvey,
          loadFromStash,
      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => useContext(SurveyDataContext);