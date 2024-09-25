import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { encode, decode } from 'base-64'
// import PhotoTask from '../tasks/photo/PhotoTask'
// import TextTask from '../tasks/text/TextTask'
import TaskManifest from '../tasks/TaskManifest';
import SurveyCollection from '../utils/SurveyCollection';
import SurveyItem from '../utils/SurveyItem';
import { v4 as uuidv4 } from 'uuid';

// Custom function to parse custom input format to javascript object for options field
// For example: "options: [option1, option2, option3], required: true, maxSelections: 2"
function parseCustomInput(input) {
    const result = {};
    const regex = /(\w+):\s*(\[[^\]]*\]|true|false|\d+|[^,]+)/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
        console.log("match: ", match)
        const key = match[1];
        let value = match[2].trim();

        if (value.startsWith('[') && value.endsWith(']')) {
            // Parse array
            value = value.slice(1, -1).split(',').map(item => item.trim());
        } else if (value === 'true' || value === 'false') {
            // Parse boolean
            value = value === 'true';
        } else if (!isNaN(value)) {
            // Parse number
            value = Number(value);
        }

        result[key] = value;
    }

    return result;
}

const convertXLSXToSurvey = async (uri, surveyName) => {
    return new Promise(async (resolve, reject) => {
        try {
            
            console.debug('reading: ', uri)
            const xlsxContent = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

            console.debug("decodeing file to binary")
            // Decode base64 content
            const decodedContent = decode(xlsxContent);
            
            console.debug("parsing workbook")
            // Parse XLSX content
            const workbook = XLSX.read(decodedContent, { type: 'binary' });

            console.debug("workbook parsed")

            let newSurveyState = {
                name: surveyName,
                collections: [],
                tasks: []
            };

            // Extract data from the workbook and reconstruct survey design object
            // tasks ****************************

            const firstSheetName = workbook.SheetNames[0]; // Get the name of the first sheet
            const firstSheet = workbook.Sheets[firstSheetName]; // Get the first sheet object

            // Convert the first sheet to a JSON object
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            console.debug("length of jsonData: ", jsonData.length)

            for (let i = 1; i < jsonData.length; i++) { // Start from index 1 to skip the header row
                const row = jsonData[i]; // Get the current row

                // Check if the first cell of the row is undefined (or any other key cell that should always have data)
                if (row[0] === undefined) {
                    break; // Exit the loop if the first cell is undefined, indicating an empty row
                }
                
                // Extract data from the row
                const taskTypeName = row[0]
                const taskTypeID = row[1]
                const taskDisplayName = row[2];
                const dataLabel = row[3];
                const instructions = row[4];
                const options = row[5];
                console.debug("options: ", options)

                const parsedOptions = parseCustomInput(options);
                console.debug("parsedOptions: ", parsedOptions)
            
                // Create a new Task instance and add it to the tasks array
                console.debug("creating new task")
                console.debug(taskTypeID, taskTypeName, taskDisplayName, dataLabel, instructions)

                //check if the taskTypeID is not in TaskManifest keys
                if (!(taskTypeID in TaskManifest)) {
                    throw new Error("Unknown task typeID: " + taskTypeID);
                }
                
                let taskID = uuidv4();
                let newTask = new TaskManifest[parseInt(taskTypeID)].taskModule(taskID, taskDisplayName, dataLabel, instructions, parsedOptions);

                console.debug("adding task to survey")
                newSurveyState.tasks.push(newTask);
            }
            console.debug("Finished Adding Tasks")
            console.debug(newSurveyState)

            // COLLECTIONS/SUBCOLLECTIONS/ITEMS ****************************

            for (let i = 1; i < workbook.SheetNames.length; i++) {
                const sheetName = workbook.SheetNames[i];
                const worksheet = workbook.Sheets[sheetName];

                //const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                console.debug(sheetName)
            
                // Create a new Collection instance
                let currentCollection = new SurveyCollection({name: sheetName})

                console.debug("current collection ID")
                console.debug(currentCollection.ID)

                // *****************************************************
                // This sheet contains subcollections
                console.debug("Checking for subcollections.....")
                if (worksheet['A2'] && worksheet['A2'].v != null && worksheet['A2'].v !== '' )  {
                    
                    console.debug("subcollections found...")
                    // create a new subcollection
                    let currentSubCollection = null;

                    console.debug("looping through rows...")

                    let i = 0;
                    for (const row in worksheet) {
                        console.debug("row:", row)
                        console.debug("i:", i)

                        if (i === 0) {
                            console.debug("skipping first row")
                            i++;
                            continue;
                        }
                    
                        // Check for indicator of new subcollection
                        let subCollectionAddr = XLSX.utils.encode_cell({r:i, c:0});

                        if (worksheet[subCollectionAddr] && worksheet[subCollectionAddr].v && worksheet[subCollectionAddr] != '') {

                            console.debug("new subcollection found...")
                            console.debug(subCollectionAddr)
                            console.debug(worksheet[subCollectionAddr].v)

                            // if the existing subcollection is not empty, add it to the collection before creating a new one
                            if(currentSubCollection){
                                console.debug("subcollection is not empty..")
                                currentCollection.subCollections.push(currentSubCollection)
                                currentSubCollection = null //just for good measure
                            }

                            console.debug("creating new subcollection....")
                            currentSubCollection = new SurveyCollection({name: worksheet[subCollectionAddr].v, parentId: currentCollection.ID, parentName: currentCollection.name})

                        } else {
                            console.debug("creating new item...")
                            //create a new item
                            let itemIDAddr = XLSX.utils.encode_cell({r:i, c:1});
                            let itemNameAddr = XLSX.utils.encode_cell({r:i, c:2});

                            if(worksheet[itemNameAddr] && worksheet[itemNameAddr].v) {

                                console.debug(itemNameAddr)

                                let itemName = worksheet[itemNameAddr].v
                                let itemID = worksheet[itemIDAddr] ? worksheet[itemIDAddr].v : undefined;
                                itemID = itemID !== undefined ? String(itemID) : undefined;
                                
                                console.debug("NAME AND ID:")
                                console.debug(itemName)
                                console.debug(itemID)
                                
                                console.log("creating instance of survey item...")
                                let newItem = new SurveyItem({name: itemName, id: itemID});

                                console.debug("adding new item to subcollection....")
                                currentSubCollection.items.push(newItem)

                            } else {
                                console.debug("No more rows found in sheet: " + sheetName)
                                currentCollection.subCollections.push(currentSubCollection)

                                break;
                            }
                        }

                        i++;
                    }
                      
                // ******************************************
                // This sheet does not contain subcollections
                } else {
                    console.debug("No subcollections present")
                    let i = 0;
                    for (const row in worksheet) {
                        console.debug("row:", row)
                        console.debug("i:", i)
                        if (i === 0) {
                            console.debug("skipping first row")
                            i++;
                            continue;
                        }
                        console.debug("creating new item...")
                        // Create a new item
                        let itemIDAddr = XLSX.utils.encode_cell({r:i, c:1});
                        let itemNameAddr = XLSX.utils.encode_cell({r:i, c:2});

                        console.debug("itemIDAddr: ", itemIDAddr)
                        console.debug("itemNameAddr: ", itemNameAddr)

                        // Check if itemName cell exists and has a value
                        if (worksheet[itemNameAddr] && worksheet[itemNameAddr].v) {
                            console.debug(itemNameAddr)

                            let itemName = worksheet[itemNameAddr].v;
                            let itemID = worksheet[itemIDAddr] ? worksheet[itemIDAddr].v : undefined;
                            itemID = itemID !== undefined ? String(itemID) : undefined; // Use itemID if available, otherwise undefined

                            console.debug("NAME AND ID:")
                            console.debug(itemName)
                            console.debug(itemID)

                            console.debug("creating instance of survey item...")
                            // Conditionally include itemID only if it's not undefined
                            let newItem = new SurveyItem({name: itemName, id: itemID});

                            console.debug("adding new item to collection: ", newItem.name)

                            currentCollection.items.push(newItem);
                        } else {
                            console.debug("No more rows found in sheet: " + sheetName);
                            break;
                        }
                        i++;
                    }
                    
                }

                    // Add the finished collection to the newSurveySate after each sheet has been read
                    newSurveyState.collections.push(currentCollection)
                }

            resolve(newSurveyState);

        } catch (error) {
            console.error('Error converting XLSX to survey:', error);
            reject(error);
        }
    });
};

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

export { convertXLSXToSurvey, convertSurveyToXLSX };

