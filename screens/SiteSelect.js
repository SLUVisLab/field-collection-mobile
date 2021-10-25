import React, {useState} from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import {Picker} from '@react-native-picker/picker';

const data = [
  { id: "", name: "" },
  { id: "1", name: "Site 1" },
  { id: "2", name: "Site 2" },
  { id: "3", name: "Site 3" },
  { id: "4", name: "Site 4" },
  { id: "5", name: "Site 5" },
];


function SiteSelect({ navigation }) {
  const [selectedSite, setSelectedSite] = useState();
  return (
    <View style={styles.container}>   
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <View
            style={styles.heading}
          >
            <Text style={styles.textheading}>Please select a site</Text>
        </View>

        <Picker
          style={styles.picker}
          selectedValue={selectedSite}
          onValueChange={ (itemValue, itemIndex) => setSelectedSite(itemValue)}
          animationType="slide"
          itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}
        >
          <Picker.Item label="Site 1" value="Site 1" />
          <Picker.Item label="Site 2" value="Site 2" />
          <Picker.Item label="Site 3" value="Site 3" />
          <Picker.Item label="Site 4" value="Site 4" />
        </Picker>
        <View style={{height:10}}></View>

        <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('TaskSelect', {type: null, selectedSite: selectedSite})}
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

export default SiteSelect;
