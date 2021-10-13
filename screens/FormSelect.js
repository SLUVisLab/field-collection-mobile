import React, {useState} from 'react';
import { Text, View} from 'react-native';
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
      <Text style={styles.textdark}>Please select from the list of surveys available.</Text>

      <Picker
        style={styles.picker}
        selectedValue={selectedForm}
        onValueChange={ (itemValue, itemIndex) => setSelectedForm(itemValue)}
        animationType="slide"
      >
        <Picker.Item label="Form 1" value="Form 1" />
        <Picker.Item label="Form 2" value="Form 2" />
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

    </View>
  );
}

export default FormSelect;
