import React from 'react';
import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

function FormComplete({ navigation }) {
    return (
      <View style={styles.container}>
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

      </View>
    );
}

export default FormComplete;
