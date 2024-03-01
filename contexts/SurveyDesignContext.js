import React, { createContext, useState, useContext } from 'react';
import Task from '../tasks/Task'

const SurveyDesignContext = createContext();

export const SurveyDesignProvider = ({ children }) => {
  const [surveyDesign, setSurveyDesign] = useState({
    name: null,
    lastSubmitted: null,
    collections: [],
    tasks: []
  });

  // Set survey name
  const setName = (name) => {
    if (name instanceof String) {
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
      setSurveyDesign((prevData) => ({
        ...prevData,
        tasks: [...prevData.tasks, newTask]
      }));
    } else {
      console.error("Invalid task type. Only instances of type Task are accepted.");
    }
  };

  // Update Task in survey
  const updateTask = (updatedTask) => {
    if (updatedTask instanceof Task) {
      setSurveyDesign((prevData) => ({
        ...prevData,
        tasks: prevData.tasks.map(task =>
          task.taskID === updatedTask.taskID ? updatedTask : task
        )
      }));
    } else {
      console.error("Invalid task type. Only instances of type Task are accepted.");
    }
  };

  const getTaskByID = (taskID) => {
    const task = surveyDesign.tasks.find(task => task.taskID === taskID);
    return task !== undefined ? task : null;
  }
  

  return (
    <SurveyDesignContext.Provider value={{ surveyDesign, setName, addTask, updateTask, getTaskByID }}>
      {children}
    </SurveyDesignContext.Provider>
  );
};

export const useSurveyDesign = () => useContext(SurveyDesignContext);