import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';


const NumberSetup = ({ options, setOptions }) => {
    
    console.log("Options: ", options);

    const handleTextChange = (newValue) => {
        setOptions({ exampleKey: newValue });
    };

    return (
        <View>
            <Text>Options Stuff Here!</Text>
            <TextInput
                placeholder="Enter value for exampleKey"
                onChangeText={handleTextChange}
                style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
            />
            <Text>Current Options: {JSON.stringify(options)}</Text>
        </View>
    );
};

export default NumberSetup;