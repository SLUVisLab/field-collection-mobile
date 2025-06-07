import 'expo-dev-client';
import React, { useEffect } from 'react';

import RealmWrapper from './contexts/RealmWrapper';
import Toast from 'react-native-toast-message';

import 'react-native-get-random-values'

import { SurveyDesignProvider } from "./contexts/SurveyDesignContext";
import { SurveyDataProvider } from "./contexts/SurveyDataContext";

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

// const APP_ID = 'data-collection-0-pybsrtz';

const Stack = createNativeStackNavigator();

// const SyncErrorFallback = ({errorMessage}) => (
//   <View style={styles.ErrorBoundryFallbackContainer}>
//     <Text style={styles.ErrorBoundryFallbackText}>App Failed to initialize. Please check for network connection and reload.</Text>
//     {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
//   </View>
// );

// const styles = StyleSheet.create({
//   ErrorBoundryFallbackContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//   },
//   ErrorBoundryFallbackText: {
//     fontSize: 16,
//     color: 'red',
//   },
//   errorMessage: {
//     marginTop: 10,
//     fontSize: 14,
//     color: 'black',
//     textAlign: 'center',
//   },
// });

// // an alternate option for realmAccessBehavior
// // which will download the realm before opening it
// // and if it takes more than 1 second, it will open the local realm
// const realmAccessBehavior = {
//   type: 'downloadBeforeOpen',
//   timeOutBehavior: 'openLocalRealm',
//   timeOut: 1000,
// };

// const realmAccessBehavior = {
//   type: OpenRealmBehaviorType.OpenImmediately,
// };

class App extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <RealmWrapper>
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
        <Toast />
      </RealmWrapper>
    );
  }
}

export default App;