import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import SiteSelect from './screens/SiteSelect';
import BlockSelect from './screens/BlockSelect';
import TaskSelect from './screens/TaskSelect';
import QRCode from './screens/QRCode';
import FormView from './screens/FormView';
import BlockView from './screens/BlockView';
import FormComplete from './screens/FormComplete';

const Stack = createNativeStackNavigator();

class App extends React.Component {

  constructor(props) {
    super(props)

    global.selectedSite = 'NULL';
    global.selectedBlock = 'NULL';
    global.selectedTask = 'NULL';
    global.selectedPlant = 'NULL';
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
          <Stack.Screen options={{headerShown: true}} name="FormView" component={FormView} />
          <Stack.Screen options={{headerShown: true}} name="Camera" component={QRCode} />
          <Stack.Screen options={{headerShown: true}} name="BlockView" component={BlockView} />
          <Stack.Screen name="FormComplete" component={FormComplete} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}

export default App;