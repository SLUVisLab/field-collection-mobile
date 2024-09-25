import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import { useEmailPasswordAuth, AuthOperationName } from '@realm/react';

const Login = ({ onRegisterClick }) => {

    const {logIn, result} = useEmailPasswordAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const performLogin = () => {
        logIn({email, password});
      };

    useEffect(() => {
      if (result.operation === AuthOperationName.LogIn) {
        if (result.success) {
          // Handle successful login
          console.log('Login successful');
          console.log(result);
        } else {
          // Handle failed login
          //TODO: fix this. This block fires when login is pending. 
          console.log('Login failed');
          console.log(result)
          setPassword('');
          Toast.show({
            type: 'failure',
            position: 'bottom',
            text1: 'Login Failed',
            visibilityTime: 1000,
            autoHide: true,
            topOffset: 30,
            bottomOffset: 40,
          });
        }
      }
    }, [result]);
  
    return (
      <View style={styles.container}>
        
        <Text style={styles.loginWrapperTitle}>Login</Text>

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
        <View style={styles.spacer}></View>
        <TouchableOpacity style={styles.button} onPress={performLogin}>
          <Text style={styles.text}>Login</Text>
        </TouchableOpacity>
  
        <TouchableOpacity style={styles.button} onPress={onRegisterClick}>
          <Text style={styles.text}>Register</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  export default Login;