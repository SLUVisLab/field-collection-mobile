import 'expo-dev-client';
import React from 'react';
import Realm from "realm";

import Toast from 'react-native-toast-message';

import { SurveyDesignProvider } from "./contexts/SurveyDesignContext";
import { SurveyDataProvider } from "./contexts/SurveyDataContext";
import { FileProvider } from './contexts/FileContext';
import { RealmProvider } from '@realm/react';

import Survey from './models/Survey';
import Response from './models/Response';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import SiteSelect from './screens/SiteSelect';
import BlockSelect from './screens/BlockSelect';
import TaskSelect from './screens/TaskSelect';
import QRCode from './screens/QRCode';
import WebView from './screens/WebView';
import BlockView from './screens/BlockView';
import FormComplete from './screens/FormComplete';
import SheetScreen from './screens/SheetScreen';
import SurveyDesignList from './screens/SurveyDesignList';
import SurveyList from './screens/SurveyList';
import SurveyName from './screens/SurveyName';
import SurveyBuilder from './screens/SurveyBuilder';
import TaskSelector from './screens/TaskSelector';
import CollectionDesignList from './screens/CollectionDesignList';
import CollectionList from './screens/CollectionList';
import CollectionName from './screens/CollectionName';
import ItemName from './screens/ItemName';
import TaskSetup from './screens/TaskSetup';
import TaskAction from './screens/TaskAction';
import SubmitSurvey from './screens/SubmitSurvey';

// Define your configuration options
const realmConfig = {
  schema: [Response, Survey],
  deleteRealmIfMigrationNeeded: true,  // SET TO FLASE IN PRODUCITON!!!!
  schemaVersion: 2,
  migration: (oldRealm, newRealm) => {
    // Migration logic goes here
  },
  // Other configuration options can be set here as needed
};

const Stack = createNativeStackNavigator();

class App extends React.Component {

  constructor(props) {
    super(props)

    global.selectedSite = 'NULL';
    global.selectedBlock = 'NULL';
    global.selectedTask = 'NULL';
    global.selectedPlant = 'NULL';
    global.selectedRow = 'NULL';
    global.selectedColumn = 'NULL';
    global.selectedUrl = 'NULL';
    global.isDone = Array(100).fill(0).map(row => new Array(100).fill(0))
  }

  render() {
    return (
      <RealmProvider {...realmConfig}>
        <NavigationContainer>
          <FileProvider>
            <SurveyDesignProvider>
              <SurveyDataProvider>
                <Stack.Navigator 
                  initialRouteName="Home"
                  screenOptions={{
                    headerShown: false
                  }}
                >
                  <Stack.Screen name="Home" component={HomeScreen} />
                  <Stack.Screen name="SiteSelect" component={SiteSelect} />
                  <Stack.Screen name="BlockSelect" component={BlockSelect} />
                  <Stack.Screen name="TaskSelect" component={TaskSelect} />
                  <Stack.Screen options={{headerShown: true}} name="SheetScreen" component={SheetScreen} />
                  <Stack.Screen options={{headerShown: true, title: 'Surveys',}} name="SurveyDesignList" component={SurveyDesignList} />
                  <Stack.Screen options={{headerShown: true, title: 'Surveys',}} name="SurveyList" component={SurveyList} />
                  <Stack.Screen options={{headerShown: true, title: 'New Survey',}} name="SurveyName" component={SurveyName} />
                  <Stack.Screen options={{headerShown: true, title: 'Survey',}} name="SurveyBuilder" component={SurveyBuilder} />
                  <Stack.Screen options={{headerShown: true, title: 'Summary',}} name="SubmitSurvey" component={SubmitSurvey} />
                  <Stack.Screen options={{headerShown: true, title: 'Tasks',}} name="TaskSelector" component={TaskSelector} />
                  <Stack.Screen options={{headerShown: true, title: 'Task Action',}} name="TaskAction" component={TaskAction} />
                  <Stack.Screen options={{headerShown: true, title: 'Collections',}} name="CollectionDesignList" component={CollectionDesignList} />
                  <Stack.Screen options={{headerShown: true, title: 'Collections',}} name="CollectionList" component={CollectionList} />
                  <Stack.Screen options={{headerShown: true, title: 'New Collection',}} name="CollectionName" component={CollectionName} />
                  <Stack.Screen options={{headerShown: true, title: 'New Item',}} name="ItemName" component={ItemName} />
                  <Stack.Screen options={{headerShown: true}} name="TaskSetup" component={TaskSetup} />
                  <Stack.Screen options={{headerShown: true}} name="WebView" component={WebView} />
                  <Stack.Screen options={{headerShown: true}} name="Camera" component={QRCode} />
                  <Stack.Screen options={{headerShown: true, headerBackVisible: false}} name="BlockView" component={BlockView} />
                  <Stack.Screen name="FormComplete" component={FormComplete} />
                  
                  
                </Stack.Navigator>
              </SurveyDataProvider>
            </SurveyDesignProvider>
          </FileProvider>
        </NavigationContainer>
        <Toast ref={(ref) => Toast.setRef(ref)} />
      </RealmProvider>
      
    );
  }
}

export default App;