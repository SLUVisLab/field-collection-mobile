import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {storage, auth} from '../firebase';
import * as FileSystem from 'expo-file-system';
import crashlytics from '@react-native-firebase/crashlytics';

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

  // Update an existing observation by its ID
  const updateObservation = (updatedObs) => {
    setSurveyData((prevData) => ({
      ...prevData,
      observations: prevData.observations.map(obs =>
        obs.ID === updatedObs.ID ? updatedObs : obs
      )
    }));
  };

  // Move observation data from one item to another by updating item/collection fields
  const moveObservationToItem = (sourceItemID, targetItem, targetCollection) => {
    setSurveyData((prevData) => {
      const updatedObservations = prevData.observations.map(obs => {
        if (obs.itemID === sourceItemID) {
          // Create updated observation with new item/collection info but same data
          return {
            ...obs,
            itemName: targetItem.name,
            itemID: targetItem.ID,
            collectionName: targetCollection.name,
            collectionID: targetCollection.ID,
            parentCollectionName: targetCollection.parentName ? targetCollection.parentName : null,
            parentCollectionID: targetCollection.parentId ? targetCollection.parentId : null,
          };
        }
        return obs;
      });
      
      return { ...prevData, observations: updatedObservations };
    });
  };

  // Delete observation data for a specific item
  const deleteObservationByItemID = (itemID) => {
    setSurveyData((prevData) => ({
      ...prevData,
      observations: prevData.observations.filter(obs => obs.itemID !== itemID)
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

      // Create a fresh, updated copy
      const updatedSurvey = {
        ...surveyData,
        user: user,
        collections: [...surveyDesign.collections],
        tasks: [...surveyDesign.tasks],
        surveyComplete: true,
        stopTime: Date.now()
      };
      // try {
      //   surveyData.user = user;
      //   surveyData.collections = [...surveyDesign.collections];
      //   surveyData.tasks = [...surveyDesign.tasks];
      //   surveyData.surveyComplete = true;
      //   surveyData.stopTime = Date.now();
      // } catch(e) {
      //   console.log("Failed to process survey: ", e);
      // }

      try {
        const jsonValue = JSON.stringify(updatedSurvey)
        console.log("Saving survery to:")
        console.log(`@savedSurvey_${updatedSurvey.surveyName.replace(/\s/g, '_')}_${Date.now()}`)
        await AsyncStorage.setItem(`@savedSurvey_${updatedSurvey.surveyName.replace(/\s/g, '_')}_${Date.now()}`, jsonValue)
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

  const resolvePath = (path) => {
    if (path.startsWith('file://')) {
        // Absolute path: Replace the old application ID with the current cache directory
        const relativePath = path.replace(/^.*Library\/Caches\//, '');
        return `${FileSystem.cacheDirectory}${relativePath}`;
    }
    // Relative path: Prepend the cache directory
    return `${FileSystem.cacheDirectory}${path}`;
  };

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


  // Add state to track uploads across the app
  const [uploadTasks, setUploadTasks] = useState({});
  const activeUploads = useRef({});

  // Track upload progress of each survey
  const [uploadProgress, setUploadProgress] = useState({});

  // Function to update the progress of a specific survey upload
  const updateUploadProgress = (surveyKey, status, progress, fileProgress = null) => {
    setUploadProgress(prev => ({
      ...prev,
      [surveyKey]: {
        status,
        progress,
        fileProgress, // Optional detailed progress of individual files
        updatedAt: Date.now(),
      }
    }));
  };

  // Function to cancel an active upload
  const cancelUpload = (surveyKey) => {
    if (activeUploads.current[surveyKey]) {
      // Cancel all active upload tasks for this survey
      Object.values(activeUploads.current[surveyKey]).forEach(task => {
        if (task && typeof task.cancel === 'function') {
          task.cancel();
        }
      });
      
      // Clean up the reference
      delete activeUploads.current[surveyKey];
      
      // Update the progress state
      updateUploadProgress(surveyKey, 'cancelled', 0);
      
      return true;
    }
    return false;
  };

  // Modified uploadToMediaStorage function with improved progress tracking
  // Create references once at initialization
  const projectRef = ref(storage, 'beta-group');
  const imagesRef = ref(projectRef, 'images');

  const uploadToMediaStorage = async (path, context = {}, surveyKey = null, progressInfo = null) => {
    if(!auth.currentUser) {
      console.log('User is not authenticated. Cannot upload file.');
      
      // Add context with attributes
      crashlytics().setAttributes({
        errorType: 'authentication_error',
        path: path || 'unknown',
        surveyKey: surveyKey || 'unknown',
        context: JSON.stringify(context.itemName)
      });
      
      // Add descriptive logs
      crashlytics().log('Upload failed: User not authenticated');
      
      const error = new Error('User is not authenticated. Cannot upload file.');
      crashlytics().recordError(error);
      throw error;
    }
    
    try {
      console.log("Uploading with context:", context);
      
      // Check if file exists before fetching
      try {
        const fileInfo = await FileSystem.getInfoAsync(path);
        console.log("FILE EXISTS:", fileInfo.exists, "SIZE:", fileInfo.size);
        
        if (!fileInfo.exists) {
          // Add context with attributes
          crashlytics().setAttributes({
            errorType: 'file_missing',
            path: path || 'unknown',
            surveyKey: surveyKey || 'unknown',
            itemID: context.itemID || 'unknown',
            itemName: context.itemName || 'unknown'
          });
          
          // Add descriptive logs
          crashlytics().log(`File does not exist: ${path}`);
          crashlytics().log(`Context: ${JSON.stringify(context.itemName)}`);
          
          const error = new Error(`File does not exist: ${path}`);
          crashlytics().recordError(error);
          throw error;
        }
      } catch (error) {
        console.error("FILE CHECK ERROR:", error);
        
        // Add context with attributes
        crashlytics().setAttributes({
          errorType: 'file_check_error',
          path: path || 'unknown',
          surveyKey: surveyKey || 'unknown',
          errorMessage: error.message,
          context: JSON.stringify(context.itemName)
        });
        
        // Add descriptive logs
        crashlytics().log(`Error checking file: ${path}`);
        crashlytics().log(`Error details: ${error.message}`);
        
        crashlytics().recordError(error);
        throw error;
      }

      // get the image file
      let response;
      try {
        response = await fetch(path);
        console.log("FETCH COMPLETE. Status:", response.status, "OK:", response.ok);
      } catch (error) {
        console.error("FETCH ERROR:", error);
        
        // Add context with attributes
        crashlytics().setAttributes({
          errorType: 'fetch_error',
          path: path || 'unknown',
          surveyKey: surveyKey || 'unknown',
          errorMessage: error.message,
          context: JSON.stringify(context.itemName)
        });
        
        // Add descriptive logs
        crashlytics().log(`Error fetching file: ${path}`);
        crashlytics().log(`Error details: ${error.message}`);
        
        crashlytics().recordError(error);
        throw error;
      }
      
      // Try to get blob
      let blob;
      try {
        blob = await response.blob();
        console.log("BLOB RECEIVED. Size:", blob.size, "Type:", blob.type);
      } catch (error) {
        console.error("BLOB ERROR:", error);
        
        // Add context with attributes
        crashlytics().setAttributes({
          errorType: 'blob_conversion_error',
          path: path || 'unknown',
          surveyKey: surveyKey || 'unknown',
          responseStatus: String(response?.status), // Converted to string
          responseOk: response?.ok ? 'true' : 'false',
          context: JSON.stringify(context.itemName)
        });
        
        // Add descriptive logs
        crashlytics().log(`Error creating blob from: ${path}`);
        crashlytics().log(`Response status: ${response?.status}, OK: ${response?.ok}`);
        
        crashlytics().recordError(error);
        throw error;
      }

      const ext = getFileExtensionFromPathOrBlob(path, blob) || 'jpg';
      
      // Include the surveyID when generating the filename
      let fileName = generateDescriptiveFilename({
        parent: context.parentName,
        subcollection: context.subcollectionName,
        item: context.itemName,
        itemID: context.itemID,
        index: context.index,
        surveyID: context.surveyID, // Use the survey ID from context
        extension: ext,
      });

      console.log("Generated filename:", fileName);

      // create a reference in the storage server
      let fileRef = ref(imagesRef, fileName);
      
      const metadata = { contentType: blob.type || `image/${ext}` };

      const uploadTask = uploadBytesResumable(fileRef, blob, metadata);

      blob = null; //  Clear early to help GC
      response = null; //  Clear early to help GC

      // If we have a surveyKey, register this task for tracking/cancellation
      if (surveyKey) {
        if (!activeUploads.current[surveyKey]) {
          activeUploads.current[surveyKey] = {};
        }
        
        // Store the task using the file path as a unique identifier
        const fileKey = `${context.itemID || ''}_${context.index || 0}`;
        activeUploads.current[surveyKey][fileKey] = uploadTask;
      }

      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            // Get task progress, including the number of bytes uploaded and the total number of bytes
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload of ${fileName} is ${progress.toFixed(1)}% done`);
            
            // If we're tracking this upload as part of a survey and have progress info
            if (surveyKey && uploadProgress[surveyKey] && progressInfo) {
              // Get current progress data
              setUploadProgress(prev => {
                // Don't update if we're no longer in uploading state
                if (!prev[surveyKey] || 
                    !['uploading', 'starting', 'preparing'].includes(prev[surveyKey].status)) {
                  return prev;
                }

                // Keep track of file progress
                const currentProgress = prev[surveyKey];
                const fileProgress = {...(currentProgress.fileProgress || {})};
                const fileKey = `${context.itemID || ''}_${context.index || 0}`;
                
                fileProgress[fileKey] = {
                  fileName,
                  progress: Math.round(progress),
                  state: snapshot.state
                };
                
                // Only let progress increase, never decrease
                const baseProgress = progressInfo.uploadedCount / progressInfo.totalFiles;
                const fileContribution = (1 / progressInfo.totalFiles) * (progress / 100);
                const calculatedProgress = Math.round((baseProgress + fileContribution) * 80);
                
                // Ensure progress never goes backward
                const newProgress = Math.max(calculatedProgress, currentProgress.progress || 0);
                
                return {
                  ...prev,
                  [surveyKey]: {
                    ...currentProgress,
                    status: 'uploading',
                    progress: Math.min(newProgress, 89), // Cap at 89% until all files complete
                    fileProgress,
                    updatedAt: Date.now()
                  }
                };
              });
            }
          }, 
          (error) => {
            console.error(`Upload error for ${fileName}:`, error);
            
            // Clean up the task reference if we were tracking it
            if (surveyKey && activeUploads.current[surveyKey]) {
              const fileKey = `${context.itemID || ''}_${context.index || 0}`;
              delete activeUploads.current[surveyKey][fileKey];
            }

            blob = null;
            response = null;
            fileName = null;
            fileRef = null;
            context = null;
            
            // Add context with attributes
            crashlytics().setAttributes({
              errorType: 'firebase_upload_error',
              path: path || 'unknown',
              fileName: fileName,
              firebaseErrorCode: error.code || 'unknown',
              surveyKey: surveyKey || 'unknown',
              context: JSON.stringify(context.itemName)
            });
            
            // Add descriptive logs
            crashlytics().log(`Firebase upload error for file: ${fileName}`);
            crashlytics().log(`Error code: ${error.code}, message: ${error.message}`);
            
            crashlytics().recordError(error);
            
            switch (error.code) {
              case 'storage/canceled':
                console.log("Upload was canceled");
                reject(new Error('Upload was canceled'));
                break;
              default:
                reject(error);
                break;
            }
          }, 
          () => {
            // Upload completed successfully
            fileRef = uploadTask.snapshot.ref;       

            getDownloadURL(fileRef).then((downloadURL) => {
              console.log(`File ${fileName} uploaded successfully`);
              
              // Clean up the task reference if we were tracking it
              if (surveyKey && activeUploads.current[surveyKey]) {
                const fileKey = `${context.itemID || ''}_${context.index || 0}`;
                delete activeUploads.current[surveyKey][fileKey];
              }
              // Explicitly null out heavy references
              fileRef = null;
              fileName = null;
              context = null;

              resolve(downloadURL);
            });
          }
        );
      });
    } catch (error) {
      console.error("Upload to Media Storage Failed:", error);
      
      // Add context with attributes for general errors
      crashlytics().setAttributes({
        errorType: 'general_upload_error',
        path: path || 'unknown',
        surveyKey: surveyKey || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        context: JSON.stringify(context.itemName)
      });
      
      // Add descriptive logs
      crashlytics().log(`General upload error for path: ${path}`);
      crashlytics().log(`Error: ${error.message}`);
      
      crashlytics().recordError(error);
      throw error;
    }
  };

  // Set max concurrent uploads
  const MAX_CONCURRENT_UPLOADS = 2;

  // Updated handleMediaItems function with concurrent uploads
  const handleMediaItems = async (survey, surveyKey) => {
    try {
      // Create a copy of the survey to avoid mutating the original object
      const processedSurvey = JSON.parse(JSON.stringify(survey));
      const localMediaPaths = [];
      
      // Get the survey ID to use for consistent file naming
      const surveyID = processedSurvey.ID || surveyKey.split('_').pop();
      
      // Build a queue of all media files to upload
      const uploadQueue = [];
      let totalMediaFiles = 0;
      
      // First, collect all media files and build the queue
      for (let i = 0; i < processedSurvey.observations.length; i++) {
        const observation = processedSurvey.observations[i];
        const data = observation.data;
        
        const context = {
          parentName: observation.parentCollectionName || '',
          subcollectionName: observation.collectionName || '',
          itemName: observation.itemName || '',
          itemID: (observation.itemID || '').substring(0, MAX_ITEM_ID_LENGTH),
        };
        
        for (const key in data) {
          const value = data[key];
          
          if (Array.isArray(value) && value.every(isMedia)) {
            for (let j = 0; j < value.length; j++) {
              uploadQueue.push({
                uri: resolvePath(value[j]),
                context: { 
                  ...context, 
                  index: j,
                  surveyID: surveyID // Pass the surveyID in the context
                },
                observationIndex: i,
                key,
                arrayIndex: j,
                isArray: true
              });
              totalMediaFiles++;
            }
          } else if (isMedia(value)) {
            uploadQueue.push({
              uri: resolvePath(value),
              context: { 
                ...context,
                surveyID: surveyID // Pass the surveyID in the context
              },
              observationIndex: i,
              key,
              isArray: false
            });
            totalMediaFiles++;
          }
        }
      }
      
      // Initialize progress tracking
      updateUploadProgress(surveyKey, 'preparing', 0, { 
        totalFiles: totalMediaFiles
      });
      
      // Begin upload process
      updateUploadProgress(surveyKey, 'uploading', 0);
      
      let completedCount = 0;
      const urls = {}; // Store results by observation index and key
      
      // Process the queue in batches with limited concurrency
      while (uploadQueue.length > 0) {
        const currentBatch = uploadQueue.splice(0, MAX_CONCURRENT_UPLOADS);
        
        // Create an array of promises for the current batch
        const uploadPromises = currentBatch.map(item => {
          return uploadToMediaStorage(item.uri, item.context, surveyKey, {
            uploadedCount: completedCount,
            totalFiles: totalMediaFiles
          })
          .then(downloadURL => {
            // Store the local media path for cleanup later
            localMediaPaths.push(item.uri);
            
            // Store the download URL for updating the survey data
            urls[item.observationIndex] = urls[item.observationIndex] || {};

            if (item.isArray) {
              const existingArray = urls[item.observationIndex][item.key] || [];
              const newArray = [...existingArray];
              newArray[item.arrayIndex] = downloadURL;
              urls[item.observationIndex][item.key] = newArray;
            } else {
              urls[item.observationIndex][item.key] = downloadURL;
            }
            
            // Increment completed count
            completedCount++;
            
            // Update progress safely using a function to ensure we get the latest state
            setUploadProgress(prev => {
              if (!prev[surveyKey]) return prev;
              
              // Calculate new progress based on completed files
              const newProgress = Math.round((completedCount / totalMediaFiles) * 80);
              
              // Only update if this would increase the progress
              if (newProgress <= prev[surveyKey].progress) return prev;
              
              return {
                ...prev,
                [surveyKey]: {
                  ...prev[surveyKey],
                  status: 'uploading',
                  progress: newProgress,
                  updatedAt: Date.now()
                }
              };
            });
            
            return downloadURL;
          });
        });
        
        // Wait for all promises in the current batch to resolve
        await Promise.all(uploadPromises);
      }
      
      // Update the processed survey with the URLs
      // for (const observationIndex in urls) {
      //   const observation = processedSurvey.observations[observationIndex];
      //   for (const key in urls[observationIndex]) {
      //     if (Array.isArray(urls[observationIndex][key])) {
      //       // Fill any gaps in array uploads (in case some uploads were missing)
      //       const existingArray = observation.data[key] || [];
      //       const newArray = [...existingArray];
            
      //       urls[observationIndex][key].forEach((url, index) => {
      //         if (url) newArray[index] = url;
      //       });
            
      //       observation.data[key] = newArray;
      //     } else {
      //       observation.data[key] = urls[observationIndex][key];
      //     }
      //   }
      // }

      // After all media is uploaded, update the processed survey
    for (const observationIndex in urls) {
      // Step 1: Clone the observation defensively to avoid mutating shared references
      const observation = { ...processedSurvey.observations[observationIndex] };

      // Step 2: Clone the `data` object separately to isolate writes
      const cleanData = { ...(observation.data || {}) };

      for (const key in urls[observationIndex]) {
        const value = urls[observationIndex][key];

        if (Array.isArray(value)) {
          // Step 3: Safely fill in array elements, preserving previous entries
          const existingArray = Array.isArray(cleanData[key]) ? [...cleanData[key]] : [];

          value.forEach((url, i) => {
            if (url) existingArray[i] = url;
          });

          cleanData[key] = existingArray;
        } else {
          // Step 4: Direct assignment for scalar/media values
          cleanData[key] = value;
        }
      }

        // Step 5: Re-assign clean `data` object back to observation
        observation.data = cleanData;

        // Step 6: Write observation back to processedSurvey
        processedSurvey.observations[observationIndex] = observation;
      }

      
      // After all media is uploaded, move to saving phase
      updateUploadProgress(surveyKey, 'saving', 90);
      
      return { processedSurvey, localMediaPaths };
    } catch (error) {
      console.error("Handle Media Failed:", error);
      
      // Add context with attributes
      crashlytics().setAttributes({
        errorType: 'media_processing_error',
        surveyKey: surveyKey || 'unknown',
        surveyName: survey?.surveyName || 'unknown',
        totalMediaFiles: String(totalMediaFiles || 0), // Converted to string
        completedCount: String(completedCount || 0), // Converted to string
        userId: auth.currentUser?.uid || 'unknown'
      });
      
      // Add descriptive logs
      crashlytics().log(`Media processing failed for survey: ${surveyKey}`);
      crashlytics().log(`Error: ${error.message}`);
      
      crashlytics().recordError(error);
      updateUploadProgress(surveyKey, 'failed', 0);
      throw error;
    }
  };

  // Updated uploadSurvey method that integrates with the progress system
  const uploadSurvey = async (storageKey, realm) => {
    const surveyKey = storageKey; // Use the storage key as the unique identifier

    // Add context with attributes
    crashlytics().setAttributes({
      action: 'survey_upload_start',
      surveyKey: surveyKey || 'unknown'
    });
    
    // Add descriptive logs
    crashlytics().log(`Starting upload for survey: ${surveyKey}`);
    crashlytics().recordError(new Error(`Test: Upload started for ${surveyKey}`));
    
    return new Promise(async (resolve, reject) => {
      let mediaPaths;

      try {

        // Initialize upload progress
        updateUploadProgress(surveyKey, 'starting', 0);
        
        // Load the survey data
        const jsonValue = await AsyncStorage.getItem(storageKey);
        if (!jsonValue) {
          // Add error context
          crashlytics().setAttributes({
            errorType: 'survey_not_found',
            surveyKey: surveyKey
          });
          crashlytics().log(`Survey data not found for key: ${surveyKey}`);
          crashlytics().recordError(new Error('Survey data not found'));
          
          updateUploadProgress(surveyKey, 'failed', 0);
          reject(new Error('Survey data not found'));
          return;
        }
        
        const surveyData = JSON.parse(jsonValue);
        
        // Process and upload media files with progress tracking
        try {
          const {processedSurvey, localMediaPaths} = await handleMediaItems(surveyData, surveyKey);
          mediaPaths = localMediaPaths;
          
          // Update progress to indicate we're saving to Realm
          updateUploadProgress(surveyKey, 'saving to database', 90);
          
          // Save to Realm database
          // console.log("Saving to realm with data:", JSON.stringify(processedSurvey, null, 2));
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
          
          // Clean up
          updateUploadProgress(surveyKey, 'cleaning up', 95);
          
          // Delete local media files
          await deleteLocalMedia(mediaPaths);
          
          // Delete the survey data from AsyncStorage
          await deleteLocalSurveyData(storageKey);
          
          // Mark as complete
          updateUploadProgress(surveyKey, 'completed', 100);
          
          // Log success
          crashlytics().setAttributes({
            action: 'survey_upload_complete',
            surveyKey: surveyKey,
            mediaCount: String(mediaPaths?.length || 0) // Converted to string
          });
          crashlytics().log(`Survey upload completed successfully: ${surveyKey}`);
          
          resolve("Survey uploaded successfully");
        } catch (error) {
          // Add context with attributes
          crashlytics().setAttributes({
            errorType: 'media_upload_error',
            surveyKey: surveyKey || 'unknown',
            surveyName: surveyData?.surveyName || 'unknown',
            userId: surveyData?.user?.id || 'unknown'
          });
          
          // Add descriptive logs
          crashlytics().log(`Survey upload media handling failed: ${surveyKey}`);
          crashlytics().log(`Error: ${error.message}`);
          
          crashlytics().recordError(error);
          console.error("Upload failed:", error);
          updateUploadProgress(surveyKey, 'failed', 0);
          reject(error);
        }
      } catch (error) {
        console.error("Upload Survey Failed:", error);
        
        // Add context with attributes
        crashlytics().setAttributes({
          errorType: 'survey_upload_error',
          surveyKey: surveyKey || 'unknown',
          stage: 'initialization',
          userId: auth.currentUser?.uid || 'unknown'
        });
        
        // Add descriptive logs
        crashlytics().log(`Survey upload failed at initialization: ${surveyKey}`);
        crashlytics().log(`Error: ${error.message}`);
        
        crashlytics().recordError(error);
        updateUploadProgress(surveyKey, 'failed', 0);
        reject(error);
      } finally {
        // Clean up any lingering upload tasks
        if (activeUploads.current[surveyKey]) {
          delete activeUploads.current[surveyKey];
        }
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
          moveObservationToItem,
          deleteObservationByItemID,
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
          cancelUpload,
          deleteLocalSurveyData,
          // quickLoadSurvey,
          uploadProgress

      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => useContext(SurveyDataContext);