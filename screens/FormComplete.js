import React from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

function FormComplete({ navigation }) {
    return (
      <View style={styles.container}>
        <ImageBackground style={styles.container}
          source={require('../assets/plantField.jpg')}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.text}>Return to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FormSelect')}
          >
            <Text style={styles.text}>Submit Another Survey for this Site</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>
    );
}

export default FormComplete;
