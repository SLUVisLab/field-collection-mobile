import React, { Component } from 'react';
import { Text, View, ImageBackground, TouchableHighlightBase } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SiteContext } from '../SiteContext';
import styles from '../Styles';
import {Picker} from '@react-native-picker/picker';

// For reference: https://stackoverflow.com/questions/43016624/react-native-apply-array-values-from-state-as-picker-items

var options = {
    "https://forms.gle/XV3DD9X7G7fQ2dgC9": "Task 1",
    "https://forms.gle/XSaLYtu1hP5tGRyN6": "Task 2",
    "https://forms.gle/82XA66DYpHs6M11w6": "Task 3",
    "https://forms.gle/EtdCCvVAZMn23osC8": "Task 4",
};


class TaskSelect extends Component {
   state = {task: ''}
   updateTask = (task) => {
      this.setState({ task: task})
   }
   render() {
      return (
        <View style={styles.container}>   
          <ImageBackground style={styles.container}
            source={require('../assets/plantField.jpg')}>
            <View
              style={styles.heading}
            >
            <Text style={styles.textheading}>Please select from the list of tasks available at {this.context.selectedSite}</Text>
            </View> 
            <Picker
            style={styles.picker}
            selectedValue={this.state.task}
            onValueChange={this.updateTask}
            animationType="slide"
            itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
              {Object.keys(options).map((key) => {
                return (<Picker.Item label={options[key]} value={key} key={key}/>) //if you have a bunch of keys value pair
              })}
            </Picker>
            <View style={{height:10}}></View>

          <TouchableOpacity
              style={styles.button}
              onPress={() => { this.context.setTask(options[this.state.task]); this.props.navigation.navigate('Camera'); }}
            >
            <Text style={styles.text}>Scan Plot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => this.props.navigation.navigate('Home')}
          >
          <Text style={styles.text}>Back Home</Text>
          </TouchableOpacity>
          </ImageBackground>
         </View>
      )
   }
}

TaskSelect.contextType = SiteContext;

export default TaskSelect;