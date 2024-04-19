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
            onPress={() => navigation.navigate('SurveyList')}
          >
            <Text style={styles.text}>Start Survey</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('SurveyDesignList')}
          >
            <Text style={styles.text}>Manage Surveys</Text>
          </TouchableOpacity>

        </ImageBackground>
      </View>
    );
}

export default HomeScreen;
