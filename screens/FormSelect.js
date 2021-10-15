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
          <Picker.Item label="Form 1" value="Form 1" />
          <Picker.Item label="Form 2" value="Form 2" />
          <Picker.Item label="Form 3" value="Form 3" />
          <Picker.Item label="Form 4" value="Form 4" />
        </Picker>
        <View style={{height:10}}></View>

        <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FormView', {type: null, data: 'https://docs.google.com/forms/d/e/1FAIpQLSfIvIoFyEUeNeuH-XpwNBKjojoTINopXElLx8kG95zPR85TiA/viewform?usp=sf_link'})}
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
