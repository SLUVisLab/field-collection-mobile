import React, {useState} from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

function FormComplete({ route, navigation }) {
  const [finished, setFinished] = useState(), params = route.params;
  console.log(params.selectedSite);
  return (
    <View style={styles.container}>
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('TaskSelect', {type: null, selectedSite: params.selectedSite})}
        >
          <Text style={styles.text}>Submit Another Task for {params.selectedSite}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('SiteSelect', {type: null, selectedSite: params.selectedSite})}
        >
          <Text style={styles.text}>Submit {params.selectedTask} for another plot</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.text}>Return to Home</Text>
        </TouchableOpacity>
      </ImageBackground>
    </View>
  );
}

export default FormComplete;
