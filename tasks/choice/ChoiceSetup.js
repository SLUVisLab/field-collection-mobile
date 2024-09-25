import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import styles from '../../Styles';

const ChoiceSetup = ({ options, setOptions }) => {
    const [newChoice, setNewChoice] = useState('');

    const handleTextChange = (newValue) => {
        setNewChoice(newValue);
    };

    const addChoice = () => {
        if (newChoice.trim() === '') {
            Alert.alert('Invalid Choice', 'Choice cannot be an empty string.');
            return;
        }

        console.log('Adding choice:', newChoice);
        setOptions(prevOptions => ({
            ...prevOptions,
            choices: [...(prevOptions.choices || []), newChoice]
        }));
        setNewChoice('');

    };

    return (
        <View style={localStyles.container}>
            <Text style={localStyles.header}>Enter a new answer choice:</Text>
            <TextInput
                placeholder="Enter new choice"
                value={newChoice}
                onChangeText={handleTextChange}
                style={styles.textInput}
            />
            <TouchableOpacity
                onPress={addChoice}
                style={styles.button}
            >
                <Text style={styles.text}>Add Choice</Text>
            </TouchableOpacity>
            <Text style={localStyles.header}>Current Choices:</Text>
            <FlatList
                data={options.choices}
                renderItem={({ item }) => <Text style={localStyles.choice}>{item}</Text>}
                keyExtractor={(item, index) => index.toString()}
            />
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        fontSize: 18,
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        marginBottom: 10,
        padding: 5,
    },
    button: {
        backgroundColor: 'blue',
        padding: 10,
        marginBottom: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
    },
    choice: {
        fontSize: 16,
        marginBottom: 5,
    },
});

export default ChoiceSetup;