import React, {useState} from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import {Picker} from '@react-native-picker/picker';

const data = [
  { id: "", name: "" },
  { id: "1", name: "Form 100" },
  { id: "2", name: "Form 2" },
  { id: "3", name: "Form 3" },
  { id: "4", name: "Form 4" },
  { id: "5", name: "Form 5" },
];


function FormSelect({ navigation }) {
  const [selectedForm, setSelectedForm] = useState();
  return (
    <View style={styles.container}>   
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <View
            style={styles.heading}
          >
            <Text style={styles.textheading}>Please select from the list of surveys available</Text>
        </View>

        <Picker
          style={styles.picker}
          selectedValue={selectedForm}
          onValueChange={ (itemValue, itemIndex) => setSelectedForm(itemValue)}
          animationType="slide"
          itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}
        >
          <Picker.Item label="Form 1" value="https://forms.gle/XV3DD9X7G7fQ2dgC9" />
          <Picker.Item label="Form 2" value="https://forms.gle/XSaLYtu1hP5tGRyN6" />
          <Picker.Item label="Form 3" value="https://forms.gle/82XA66DYpHs6M11w6" />
          <Picker.Item label="Form 4" value="https://forms.gle/EtdCCvVAZMn23osC8" />
        </Picker>
        <View style={{height:10}}></View>

        <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FormView', {type: null, data: selectedForm})}
          >
          <Text style={styles.text}>Go</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.text}>Back Home</Text>
        </TouchableOpacity>
      </ImageBackground>
    </View>
  );
}

export default FormSelect;
