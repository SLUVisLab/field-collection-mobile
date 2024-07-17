import 'expo-dev-client';
import React from 'react';
import Realm from "realm";

import {AppProvider, UserProvider} from '@realm/react';

import Toast from 'react-native-toast-message';

import 'react-native-get-random-values'

import { SurveyDesignProvider } from "./contexts/SurveyDesignContext";
import { SurveyDataProvider } from "./contexts/SurveyDataContext";
import { RealmProvider } from '@realm/react';

import SurveyResults from './models/SurveyResults';
import SurveyDesign from './models/SurveyDesign';
// import Observation from './models/Observation';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import SurveyDesignList from './screens/SurveyDesignList';
import SurveyList from './screens/SurveyList';
import NewSurvey from './screens/NewSurvey';
import SurveyBuilder from './screens/SurveyBuilder';
import TaskSelector from './screens/TaskSelector';
import CollectionDesignList from './screens/CollectionDesignList';
import CollectionList from './screens/CollectionList';
import CollectionName from './screens/CollectionName';
import NewItem from './screens/NewItem';
import TaskSetup from './screens/TaskSetup';
import TaskAction from './screens/TaskAction';
import SaveSurvey from './screens/SaveSurvey';
import UploadSurveys from './screens/UploadSurveys';

// Fallback log in component that's defined in another file.
import LoginWrapper from './screens/LoginWrapper';

// Define your configuration options
// const realmConfig = {
//   schema: [SurveyResults, Observation],
//   deleteRealmIfMigrationNeeded: true,  // SET TO FLASE IN PRODUCITON!!!!
//   schemaVersion: 3,
//   migration: (oldRealm, newRealm) => {
//     // Migration logic goes here
//   },
//   // Other configuration options can be set here as needed
// };

const APP_ID = 'data-collection-0-pybsrtz';

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
      <AppProvider id={APP_ID}>
        <UserProvider fallback={LoginWrapper}>
        {/* <RealmProvider {...realmConfig}> */}
          <RealmProvider
          schema={[SurveyResults, SurveyDesign]}
          sync={{
            flexible: true,
            initialSubscriptions: {
              update(subs, realm) {
                subs.add(realm.objects(SurveyDesign).filtered("name != nil"), {
                  name: "All Survey Designs",
                });
              },
            },
          }}>
            <NavigationContainer>
              <SurveyDesignProvider>
                <SurveyDataProvider>
                  <Stack.Navigator 
                    initialRouteName="Home"
                    screenOptions={{
                      headerShown: false
                    }}
                  >
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen options={{headerShown: true, title: 'Surveys',}} name="SurveyDesignList" component={SurveyDesignList} />
                    <Stack.Screen options={{headerShown: true, title: 'Surveys',}} name="SurveyList" component={SurveyList} />
                    <Stack.Screen options={{headerShown: true, title: 'New Survey',}} name="NewSurvey" component={NewSurvey} />
                    <Stack.Screen options={{headerShown: true, title: 'Survey',}} name="SurveyBuilder" component={SurveyBuilder} />
                    <Stack.Screen options={{headerShown: true, title: 'Summary',}} name="SaveSurvey" component={SaveSurvey} />
                    <Stack.Screen options={{headerShown: true, title: 'Upload',}} name="UploadSurveys" component={UploadSurveys} />
                    <Stack.Screen options={{headerShown: true, title: 'Tasks',}} name="TaskSelector" component={TaskSelector} />
                    <Stack.Screen options={{headerShown: true, title: 'Task Action',}} name="TaskAction" component={TaskAction} />
                    <Stack.Screen options={{headerShown: true, title: 'Collections',}} name="CollectionDesignList" component={CollectionDesignList} />
                    <Stack.Screen options={{headerShown: true, title: 'Collections',}} name="CollectionList" component={CollectionList} />
                    <Stack.Screen options={{headerShown: true, title: 'New Collection',}} name="CollectionName" component={CollectionName} />
                    <Stack.Screen options={{headerShown: true, title: 'New Item',}} name="NewItem" component={NewItem} />
                    <Stack.Screen options={{headerShown: true}} name="TaskSetup" component={TaskSetup} />
                    
                  </Stack.Navigator>
                </SurveyDataProvider>
              </SurveyDesignProvider>
            </NavigationContainer>
            <Toast ref={(ref) => Toast.setRef(ref)} />
          </RealmProvider>
        </UserProvider>
      </AppProvider>
      
    );
  }
}

export default App;