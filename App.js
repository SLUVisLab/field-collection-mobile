import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SiteContext } from './SiteContext'
import HomeScreen from './screens/HomeScreen';
import SiteSelect from './screens/SiteSelect';
import BlockSelect from './screens/BlockSelect';
import TaskSelect from './screens/TaskSelect';
import QRCode from './screens/QRCode';
import FormView from './screens/FormView';
import PlotView from './screens/PlotView';
import FormComplete from './screens/FormComplete';

const Stack = createNativeStackNavigator();

class App extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      selectedSite: 'NULL',
      selectedBlock: 'NULL',
      selectedTask: 'NULL',
      selectedPlant: 'NULL',
    }
  }

  setSite = (site) => {
    this.setState({selectedSite: site})
  }

  setPlot = (plot) => {
    this.setState({selectedPlot: plot})
  }

  setTask = (task) => {
    this.setState({selectedTask: task})
  }

  render() {
    return (
      <SiteContext.Provider
        value={
          {
            selectedSite: this.state.selectedSite,
            selectedPlot: this.state.selectedPlot,
            selectedTask: this.state.selectedTask,
            setSite: this.setSite,
            setPlot: this.setPlot,
            setTask: this.setTask
          }
        }
      >
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Home"
            screenOptions={{
              headerShown: false
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SiteSelect" component={SiteSelect} />
            <Stack.Screen name="PlotSelect" component={BlockSelect} />
            <Stack.Screen name="TaskSelect" component={TaskSelect} />
            <Stack.Screen options={{headerShown: true}} name="FormView" component={FormView} />
            <Stack.Screen options={{headerShown: true}} name="Camera" component={QRCode} />
            <Stack.Screen options={{headerShown: true}} name="PlotView" component={PlotView} />
            <Stack.Screen name="FormComplete" component={FormComplete} />
          </Stack.Navigator>
        </NavigationContainer>
      </SiteContext.Provider>
    );
  }
}

export default App;