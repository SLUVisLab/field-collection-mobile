import React from 'react';
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
      <NavigationContainer>
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
          <Stack.Screen options={{headerShown: true}} name="WebView" component={WebView} />
          <Stack.Screen options={{headerShown: true}} name="Camera" component={QRCode} />
          <Stack.Screen options={{headerShown: true, headerBackVisible: false}} name="BlockView" component={BlockView} />
          <Stack.Screen name="FormComplete" component={FormComplete} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}

export default App;