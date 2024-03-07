import React, { createContext, useContext, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { encode, decode } from 'base-64'
import PhotoTask from '../tasks/photo/PhotoTask'
import TextTask from '../tasks/text/TextTask'
import SurveyCollection from '../utils/SurveyCollection';
import SurveyItem from '../utils/SurveyItem';

// Create a new context for file operations
const FileContext = createContext();

// Context provider component
export const FileProvider = ({ children }) => {
  
    const [surveyFiles, setSurveyFiles] = useState([]);

    useEffect(() => {
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
      
        // Load survey files when the component mounts
        loadSurveyFiles();
      }, [convertSurveyToXLSX]);

    // Method to write xlsx content to file
    const convertSurveyToXLSX = async (surveyDesign) => {

        const fileName = surveyDesign.name.replace(/\s/g, '_') + '.xlsx';
        const filePath = FileSystem.documentDirectory + '/' + fileName; // Full file path

        console.log(fileName)

        const workbook = XLSX.utils.book_new();

        // Add data to the main tab
        const mainSheetData = [
            ['TaskTypeID', 'TaskID', 'TaskDisplayName', 'DataLabel', 'Instructions']
        ];

        surveyDesign.tasks.forEach(task => {
            mainSheetData.push([task.constructor.typeID, task.taskID, task.taskDisplayName, task.dataLabel, task.instructions]);
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
                
                collectionData.push(['None', '', ''])
                collection.items.forEach(item => {
                    collectionData.push(['', item.ID, item.name]); // Push empty value in subsequent iterations
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
        console.log('XLSX Content:', xlsxContent);

        const base64Content = encode(xlsxContent);
        console.log('Base64 Content:', base64Content);



        // Write XLSX content to file
        try {
            console.log('File Path:', filePath);
            await FileSystem.writeAsStringAsync(filePath, base64Content, { encoding: FileSystem.EncodingType.Base64 });
            console.log('XLSX file saved:', filePath);
        } catch (error) {
            console.error('Error writing XLSX file:', error);
        }
    };

    const convertXLSXToSurvey = async (fileName, setSurveyDesign) => {
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
            // tasks

            const firstSheetName = workbook.SheetNames[0]; // Get the name of the first sheet
            const firstSheet = workbook.Sheets[firstSheetName]; // Get the first sheet object

            // Convert the first sheet to a JSON object
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            for (let i = 1; i < jsonData.length; i++) { // Start from index 1 to skip the header row
                const row = jsonData[i]; // Get the current row
                
                // Extract data from the row
                const taskType = row[0]
                const taskID = row[1]; // Assuming TaskID is in the second column (index 1)
                const taskDisplayName = row[2]; // Assuming TaskDisplayName is in the third column (index 2)
                const dataLabel = row[3]; // Assuming DataLabel is in the fourth column (index 3)
                const instructions = row[4]; // Assuming Instructions is in the fifth column (index 4)
            
                // Create a new Task instance and add it to the tasks array
                console.log("creating new task")
                console.log(taskID, taskDisplayName, dataLabel, instructions)

                if (taskType == 1) {
                    let task = new PhotoTask(taskID, taskDisplayName, dataLabel, instructions);
                } else if (taskType == 2) {
                    let task = new TextTask(taskID, taskDisplayName, dataLabel, instructions);
                } else {
                    console.log("Unknown task type")
                }
                
                console.log("adding task to survey")
                newSurveyState.tasks.push(task);
            }

            console.log(newSurveyState)
            
            
    
            setSurveyDesign(newSurveyState)

        } catch (error) {
            console.error('Error converting XLSX to survey:', error);
            return null;
        }
    };


    // Value to be provided by the context
    const value = {
        surveyFiles,
        convertSurveyToXLSX,
        convertXLSXToSurvey
    };

    // Render the context provider with children
    return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
};

// Custom hook to use the file context
export const useFileContext = () => useContext(FileContext);