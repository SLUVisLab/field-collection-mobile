import React, {useState} from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import {Picker} from '@react-native-picker/picker';

const data = [
  { id: "", name: "" },
  { id: "1", name: "Task 100" },
  { id: "2", name: "Task 2" },
  { id: "3", name: "Task 3" },
  { id: "4", name: "Task 4" },
  { id: "5", name: "Task 5" },
];


function TaskSelect({ route, navigation }) {
  const [selectedTask, setSelectedTask] = useState(),
  params = route.params;
  return (  
    <ImageBackground style={styles.container}
      source={require('../assets/plantField.jpg')}>
      <View style={styles.container}> 
        <View
            style={styles.heading}
          >
            <Text style={styles.textheading}>Please select from the list of tasks available at {params.selectedSite}</Text>
        </View>

        <Picker
          style={styles.picker}
          selectedValue={selectedTask}
          onValueChange={ (itemValue, itemIndex) => setSelectedTask(itemValue)}
          animationType="slide"
          itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}
        >
          <Picker.Item label="Task 1" value="https://forms.gle/XV3DD9X7G7fQ2dgC9" />
          <Picker.Item label="Task 2" value="https://forms.gle/XSaLYtu1hP5tGRyN6" />
          <Picker.Item label="Task 3" value="https://forms.gle/82XA66DYpHs6M11w6" />
          <Picker.Item label="Task 4" value="https://forms.gle/EtdCCvVAZMn23osC8" />
        </Picker>
        <View style={{height:10}}></View>

        <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Camera', {type: null, selectedTask: selectedTask, selectedSite: params.selectedSite})}
          >
          <Text style={styles.text}>Scan Plot</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.text}>Back Home</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

export default TaskSelect;
