import React, { createContext, useContext, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { encode, decode } from 'base-64'
import PhotoTask from '../tasks/photo/PhotoTask'
import TextTask from '../tasks/text/TextTask'
import SurveyCollection from '../utils/SurveyCollection';
import SurveyItem from '../utils/SurveyItem';

// NOTE: This file is an excellent candidate for refactoring! Sorry, the
// first pass at getting this to work got pretty messy.


// Create a new context for file operations
const FileContext = createContext();

// Context provider component
export const FileProvider = ({ children }) => {
  
    const [surveyFiles, setSurveyFiles] = useState([]);

    const loadSurveyFiles = async () => {
        try {
          // Get the list of files in the document directory
          const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    
          const xlsxFiles = files.filter((file) => file.endsWith('.xlsx'));
          setSurveyFiles(xlsxFiles);

        } catch (error) {
          console.error('Error loading survey files:', error);
        }
      };

    useEffect(() => {
        // Load survey files when the component mounts
        loadSurveyFiles();
      }, []);

    // Method to write xlsx content to file
    const convertSurveyToXLSX = async (surveyDesign) => {

        return new Promise(async (resolve, reject) => {

            const fileName = surveyDesign.name.replace(/\s/g, '_') + '.xlsx';
            const filePath = FileSystem.documentDirectory + '/' + fileName; // Full file path

            console.log(fileName)

            const workbook = XLSX.utils.book_new();

            // Add data to the main tab
            const mainSheetData = [
                ['TaskTypeID', 'TaskType', 'TaskID', 'TaskDisplayName', 'DataLabel', 'Instructions']
            ];

            surveyDesign.tasks.forEach(task => {
                mainSheetData.push([task.constructor.typeID, task.constructor.typeDisplayName, task.taskID, task.taskDisplayName, task.dataLabel, task.instructions]);
            });

            // Convert data to sheet format
            const mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData);

            // Add the main sheet to the workbook
            XLSX.utils.book_append_sheet(workbook, mainSheet, 'Tasks');

            // Add tabs for each collection
            surveyDesign.collections.forEach(collection => {
                
                const collectionData = [
                    ['Subcollection', 'ItemID', 'Item']
                ];

                // No subcollections
                if (!collection.subCollections || collection.subCollections.length === 0){
                    
                    collection.items.forEach(item => {
                        collectionData.push(['', item.ID, item.name]);
                    });

                //With Subcollections
                } else {
                    
                    collection.subCollections.forEach(subCollection => {
                        collectionData.push([subCollection.name, '', ''])

                        subCollection.items.forEach(item => {
                            collectionData.push(['', item.ID, item.name])
                        })
                    })
                }

                // Convert data to sheet format
                const collectionSheet = XLSX.utils.aoa_to_sheet(collectionData);

                // Add the collection sheet to the workbook
                XLSX.utils.book_append_sheet(workbook, collectionSheet, collection.name);
            });

            const xlsxContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });

            const base64Content = encode(xlsxContent);

            // Write XLSX content to file
            try {
                console.log('File Path:', filePath);
                await FileSystem.writeAsStringAsync(filePath, base64Content, { encoding: FileSystem.EncodingType.Base64 });
                console.log('XLSX file saved:', filePath);

                // When the file is fully written, call resolve()
                resolve();

            } catch (error) {
                console.error('Error writing XLSX file:', error);
                reject(error)
            }
        
        
    });
    };

    const convertXLSXToSurvey = async (fileName) => {
        try {
            // Read XLSX content
            const filePath = FileSystem.documentDirectory + '/' + fileName;

            console.log(filePath)

            console.log('filesystem read')
            const xlsxContent = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
    
            console.log("decodeing file to binary")
            // Decode base64 content
            const decodedContent = decode(xlsxContent);
            
            console.log("parsing workbook")
            // Parse XLSX content
            const workbook = XLSX.read(decodedContent, { type: 'binary' });

            let newSurveyState = {
                name: null,
                lastSubmitted: null,
                collections: [],
                tasks: []
              };

            //Extract Name
            let surveyName = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.xlsx', '');

            newSurveyState.name = surveyName.replace(/_/g, ' ')

            console.log(newSurveyState)
    
            // Extract data from the workbook and reconstruct survey design object
            // tasks ****************************

            const firstSheetName = workbook.SheetNames[0]; // Get the name of the first sheet
            const firstSheet = workbook.Sheets[firstSheetName]; // Get the first sheet object

            // Convert the first sheet to a JSON object
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            for (let i = 1; i < jsonData.length; i++) { // Start from index 1 to skip the header row
                const row = jsonData[i]; // Get the current row
                
                // Extract data from the row
                const taskType = row[0]
                const taskTypeName = row[1]
                const taskID = row[2];
                const taskDisplayName = row[3];
                const dataLabel = row[4];
                const instructions = row[5];
            
                // Create a new Task instance and add it to the tasks array
                console.log("creating new task")
                console.log(taskType, taskTypeName, taskID, taskDisplayName, dataLabel, instructions)

                let newTask;

                if (taskType == 1) {
                    newTask = new PhotoTask(taskID, taskDisplayName, dataLabel, instructions);
                } else if (taskType == 2) {
                    newTask = new TextTask(taskID, taskDisplayName, dataLabel, instructions);
                } else {
                    console.log("Unknown task type")
                }

                console.log("adding task to survey")
                newSurveyState.tasks.push(newTask);
            }
            console.log("Tasks added....")
            console.log(newSurveyState)

            // COLLECTIONS/SUBCOLLECTIONS/ITEMS ****************************

            for (let i = 1; i < workbook.SheetNames.length; i++) {
                const sheetName = workbook.SheetNames[i];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                console.log(jsonData)

                console.log(sheetName)
                console.log(worksheet["rows"]) // prints undefined
            
                // Create a new Collection instance
                let currentCollection = new SurveyCollection({name: sheetName})

                console.log("current collection ID")
                console.log(currentCollection.ID)


                // *****************************************************
                // This sheet contains subcollections
                console.log("Checking for subcollections.....")
                if (worksheet['A2'] && worksheet['A2'].v != null && worksheet['A2'].v !== '' )  {
                    
                    console.log("subcollections found...")
                    // create a new subcollection
                    let currentSubCollection = null;

                    console.log("looping through rows...")

                    let i = 0;
                    for (const row in worksheet) {
                        console.log("row:", row)
                        console.log("i:", i)

                        if (i === 0) {
                            console.log("skipping first row")
                            i++;
                            continue;
                        }
                       
                        // Check for indicator of new subcollection
                        let subCollectionAddr = XLSX.utils.encode_cell({r:i, c:0});

                        if (worksheet[subCollectionAddr] && worksheet[subCollectionAddr].v && worksheet[subCollectionAddr] != '') {

                            console.log("new subcollection found...")
                            console.log(subCollectionAddr)
                            console.log(worksheet[subCollectionAddr].v)

                            // if the existing subcollection is not empty, add it to the collection before creating a new one
                            if(currentSubCollection){
                                console.log("subcollection is not empty..")
                                currentCollection.subCollections.push(currentSubCollection)
                                currentSubCollection = null //just for good measure
                            }

                            console.log("creating new subcollection....")
                            currentSubCollection = new SurveyCollection({name: worksheet[subCollectionAddr].v, parentId: currentCollection.ID, parentName: currentCollection.name})

                        } else {
                            console.log("creating new item...")
                            //create a new item
                            let itemIDAddr = XLSX.utils.encode_cell({r:i, c:1});
                            let itemNameAddr = XLSX.utils.encode_cell({r:i, c:2});

                            if((worksheet[itemIDAddr] && worksheet[itemIDAddr].v) && (worksheet[itemNameAddr] && worksheet[itemNameAddr].v)) {

                                console.log(itemNameAddr)

                                let itemName = worksheet[itemNameAddr].v
                                let itemID = worksheet[itemIDAddr].v
                                
                                console.log("NAME AND ID:")
                                console.log(itemName)
                                console.log(itemID)
                                
                                console.log("creating instance of survey item...")
                                let newItem = new SurveyItem(itemName, itemID)

                                console.log("adding new item to subcollection....")
        
                                currentSubCollection.items.push(newItem)
                            } else {
                                console.log("No more rows found")
                                currentCollection.subCollections.push(currentSubCollection) //dont forget to add the current sub coll to the array

                                break;
                            }
                        }

                        i++;
                    }
                    
                    
                // ******************************************
                // This sheet does not contain subcollections
                } else {
                    console.log("No subcollections present")
                    let i = 0;
                    for (const row in worksheet) {
                        console.log("row:", row)
                        console.log("i:", i)
                        if (i === 0) {
                            console.log("skipping first row")
                            i++;
                            continue;
                        }
                        console.log("creating new item...")
                        //create a new item
                        let itemIDAddr = XLSX.utils.encode_cell({r:i, c:1});
                        let itemNameAddr = XLSX.utils.encode_cell({r:i, c:2});

                        if((worksheet[itemIDAddr] && worksheet[itemIDAddr].v) && (worksheet[itemNameAddr] && worksheet[itemNameAddr].v)) {

                            console.log(itemNameAddr)

                            let itemName = worksheet[itemNameAddr].v
                            let itemID = worksheet[itemIDAddr].v
                            
                            console.log("NAME AND ID:")
                            console.log(itemName)
                            console.log(itemID)

                            console.log("creating instance of survey item...")
                            let newItem = new SurveyItem(itemName, itemID)

                            console.log("adding new item to collection")

                            currentCollection.items.push(newItem)
                        } else {
                            console.log("No more rows found")
                            break;
                        }
                        i++;
                    }
                    
                }

                    // Add the finished collection to the newSurveySate after each sheet has been read
                    newSurveyState.collections.push(currentCollection)
                }

                console.log(newSurveyState)

            return newSurveyState
    
            // setSurveyDesign(newSurveyState)

        } catch (error) {
            console.error('Error converting XLSX to survey:', error);
            return null;
        }
    };

    const ImportXLSXFile = (file) => {
        // handle importing xlsx files
        return null;
    }


    // Value to be provided by the context
    const value = {
        surveyFiles,
        loadSurveyFiles,
        convertSurveyToXLSX,
        convertXLSXToSurvey
    };

    // Render the context provider with children
    return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
};

// Custom hook to use the file context
export const useFileContext = () => useContext(FileContext);