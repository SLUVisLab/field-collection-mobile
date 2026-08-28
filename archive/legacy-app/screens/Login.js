import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';

const Login = ({ onRegisterClick }) => {

    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const performLogin = async () => {
      try {
        await login(email, password);
        console.log('Login successful');
      } catch (error) {
        console.log('Login failed', error);
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
    };
  
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