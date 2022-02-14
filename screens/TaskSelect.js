import React, { Component } from 'react';
import { Text, View, ImageBackground, TouchableHighlightBase } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
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

   getString(url) {
     var first = true;
     var result = ''
     var queue = [global.selectedSite, global.selectedBlock.slice(-1), global.selectedRow, global.selectedColumn];
     for (var i = 0; i < url.length; i++) {
       if (url[i] == '=') {
         if (first) {
            result += '=';
            first = false;
            continue;
         } else {
           result += '=';
           while (i < url.length && url[i+1] != '&') {
             console.log(url[i]);
             i++;
           }
           result += queue.shift();
           continue;
         }
       }
      result += url[i];
     }
      console.log(result);
      return result;
   }

   render() {
      return (
        <View style={styles.container}>   
          <ImageBackground style={styles.container}
            source={require('../assets/plantField.jpg')}>
            <View
              style={styles.heading}
            >
            <Text style={styles.textheading}>Please select from the list of tasks available from {global.selectedSite}, {global.selectedBlock}</Text>
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
              onPress={() => this.props.navigation.navigate("FormView", {type: null, data: this.getString('https://docs.google.com/forms/d/e/1FAIpQLSfbcDaOvhbHZDjiI5Chxk-RVm5lZwo6H8uyTGmytSxknVqZfg/viewform?usp=pp_url&entry.1993918266=Eureka&entry.954462119=1&entry.471766027=2&entry.308383014=3')})}
            >
            <Text style={styles.text}>Fill Out Form</Text>
          </TouchableOpacity>

          <TouchableOpacity
              style={styles.button}
              onPress={() => this.props.navigation.navigate("BlockView")}
            >
            <Text style={styles.text}>Select New Plant</Text>
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

export default TaskSelect;