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
            onPress={() => navigation.navigate('SheetScreen')}
          >
            <Text style={styles.text}>Edit Surveys</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>
    );
}

export default HomeScreen;
