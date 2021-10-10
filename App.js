import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import QRCode from './screens/QRCode';
import FormView from './screens/FormView'

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="FormView" component={FormView} />
        <Stack.Screen name="Camera" component={QRCode} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;