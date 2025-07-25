import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Modal, TouchableOpacity } from 'react-native';
import JSONTree from 'react-native-json-tree';
import * as FileSystem from 'expo-file-system';

const SurveyExplorer = ({ route }) => {
    const { survey } = route.params;
    const [selectedImage, setSelectedImage] = useState(null);

    const handleMediaClick = async (path) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(path);
            if (fileInfo.exists) {
                setSelectedImage(path);
            } else {
                Alert.alert('File Not Found', `The file at ${path} does not exist.`);
            }
        } catch (error) {
            console.error(`Error checking file at ${path}:`, error);
            Alert.alert('Error', 'An error occurred while trying to preview the image.');
        }
    };

    const renderValue = (value) => {
        if (typeof value === 'string' && value.startsWith('file://')) {
            return (
                <Text
                    style={styles.mediaLink}
                    onPress={() => handleMediaClick(value)}
                >
                    {value}
                </Text>
            );
        }
        return value;
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>{survey.surveyName}</Text>
            <Text style={styles.subtitle}>Survey ID: {survey.key}</Text>
            <Text style={styles.subtitle}>Completed: {new Date(survey.completed).toLocaleString()}</Text>
            <Text style={styles.subtitle}>Observations: {survey.count}</Text>
            <View style={styles.jsonContainer}>
                <JSONTree
                    data={survey}
                    theme="bright"
                    invertTheme={false}
                    valueRenderer={(raw, value) => renderValue(value)}
                />
            </View>
            {selectedImage && (
                <Modal
                    visible={true}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setSelectedImage(null)}
                >
                    <View style={styles.modalContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setSelectedImage(null)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f9f9f9',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 4,
    },
    jsonContainer: {
        marginTop: 16,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        elevation: 2,
    },
    mediaLink: {
        color: '#0066cc',
        textDecorationLine: 'underline',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    imagePreview: {
        width: '80%',
        height: '50%',
        borderRadius: 8,
    },
    closeButton: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#0066cc',
        borderRadius: 8,
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default SurveyExplorer;
