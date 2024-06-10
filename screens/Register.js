import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import { useEmailPasswordAuth, AuthOperationName } from '@realm/react';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const {register, result, logIn} = useEmailPasswordAuth();

    useEffect(() => {
        console.log("checking for succefful registration")
        if (result.success && result.operation === AuthOperationName.Register) {
            console.log("registration successful")
            logIn({email, password});
            
        } else {
            console.log("registration failed")
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

        

    }, [result, logIn, email, password]);

    const performRegistration = () => {
      console.log("submit button clicked")
      register({email, password});
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