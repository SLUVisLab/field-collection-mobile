import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const { register } = useAuth();

    const performRegistration = async () => {
      console.log("submit button clicked");
      try {
        // createUserWithEmailAndPassword also signs the new user in.
        await register(email, password);
        console.log("registration successful");
      } catch (error) {
        console.log("registration failed", error);
        Toast.show({
          type: 'failure',
          position: 'bottom',
          text1: 'Registration Failed',
          visibilityTime: 1000,
          autoHide: true,
          topOffset: 30,
          bottomOffset: 40,
        });
      }
    };
  
    return (
      <View style={styles.container}>

      <Text style={styles.loginWrapperTitle}>Register</Text>

        <View style={styles.inputLabelContainer}>
          <Text style={styles.inputLabel}>Email:</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            autoCorrect={false}
            autoCapitalize="none"

          />
        </View>

        <View style={styles.inputLabelContainer}>
          <Text style={styles.inputLabel}>Password:</Text>
          <TextInput
            style={styles.textInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
          />
        </View>
  
        <TouchableOpacity style={styles.button} onPress={performRegistration}>
          <Text style={styles.text}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  export default Register;