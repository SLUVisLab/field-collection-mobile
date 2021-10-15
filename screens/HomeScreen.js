import React from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

function HomeScreen({ navigation }) {
    return (
      <View style={styles.container}>
        <ImageBackground style={styles.container}
          source={require('../assets/plantField.jpg')}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('Camera')}
          >
            <Text style={styles.text}>Scan QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FormView', {type: null, data: 'https://docs.google.com/forms/d/e/1FAIpQLSfIvIoFyEUeNeuH-XpwNBKjojoTINopXElLx8kG95zPR85TiA/viewform?usp=sf_link'})}
          >
            <Text style={styles.text}>Go to Form</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('FormSelect')}
          >
            <Text style={styles.text}>Form Select Screen</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('FormComplete')}
          >
            <Text style={styles.text}>Form Complete Screen</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>
    );
}

export default HomeScreen;
