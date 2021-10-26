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
            onPress={() => navigation.navigate('SiteSelect')}
          >
            <Text style={styles.text}>Start New Walk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FormView', {type: null, data: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'})}
          >
            <Text style={styles.text}>Edit Surveys</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>
    );
}

export default HomeScreen;
