import React, { createContext, useState, useContext } from 'react';
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';
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

    console.log("New Observation: ", newObservation)

    setSurveyData((prevData) => ({
    ...prevData,
    observations: [...prevData.observations, newObservation]
    }));
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
    return observation !== undefined ? observation : null;
  }

  const itemHasObservation = (itemID)=> {
    const observation = surveyData.observations.find(obs => obs.itemID === itemID);
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
    
    setName(surveyDesign.name)
    
    setStartTime(Date.now())

    console.log("New Survey Data Instance: ", surveyData)

    //TODO: Handle Collections and Tasks
    // Keep in mind -- what about future surveys that dont have predefined collections?
    // would it be better to wait until survey submission to include these?

  }

  const saveForLater = () => {
    //TODO: implement me
    return null;
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
          newSurvey
      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => useContext(SurveyDataContext);