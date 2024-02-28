import React, { createContext, useState, useContext } from 'react';

const SurveyDesignContext = createContext();

export const SurveyDesignProvider = ({ children }) => {
  const [surveyDesign, setSurveyDesign] = useState({
    name: null,
    lastSubmitted: null,
    collections: [],
    tasks: []
  });

  // Function to set name
  const setName = (name) => {
    setSurveyDesign((prevData) => ({
      ...prevData,
      name: name
    }));
  };

  // Function to add a new question
  const addTask = (newTask) => {
    setSurveyDesign((prevData) => ({
      ...prevData,
      tasks: [...prevData.tasks, newTask]
    }));
  };
  

  return (
    <SurveyDesignContext.Provider value={{ surveyDesign, setName, addTask }}>
      {children}
    </SurveyDesignContext.Provider>
  );
};

export const useSurveyDesign = () => useContext(SurveyDesignContext);