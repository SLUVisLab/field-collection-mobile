import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import styles from '../Styles';

const LoginWrapper = () => {
  const [register, setRegister] = useState(false);

  const handleRegisterClick = () => {
    setRegister(true);
  };

  return register ? <Register/> : <Login onRegisterClick={handleRegisterClick} />;
};

export default LoginWrapper;