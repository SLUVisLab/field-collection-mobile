import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import ProgressBar from 'react-native-progress/Bar';
import { format } from 'date-fns';
import {useRealm} from '@realm/react';
import 'react-native-get-random-values'

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSurveyData } from '../contexts/SurveyDataContext';

const UploadSurveys = ({ route, navigation }) => {

    const { listAllSavedSurveys, uploadSurvey } = useSurveyData()
    const [surveys, setSurveys] = useState([]);
    const [isConnected, setIsConnected] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const realm = useRealm();

    const fetchSurveys = async () => {
        console.log("fetchSurveys called");
        const savedSurveys = await listAllSavedSurveys();
        setSurveys(savedSurveys);
    };

    useEffect(() => {   
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
            if (!state.isConnected) {
                Alert.alert("Offline", "Uploads are disabled while offline.");
            }
        });
    
        fetchSurveys();

        return () => unsubscribe();
    }, []);

    const uploadHandler = async (storageKey) => {
        if (!isConnected) {
            Toast.show({
                type: 'error',
                text1: 'You are offline',
                text2: 'Please connect to the internet to upload surveys.',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40,
            });
            return;
        }
        console.log("called upload handler");
        console.log(storageKey);

        setIsUploading(true);

        try {
            await uploadSurvey(storageKey, realm); // Pass Realm instance to the function
            console.log("Upload successful");
            fetchSurveys();

            Toast.show({
                type: 'success',
                text1: 'Upload Successful',
                text2: 'Your survey has been uploaded successfully.',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40,
            });
            
        } catch (error) {
            console.error("Upload failed", error);
            Toast.show({
                type: 'error', // Adjust the type based on your toast library's configuration
                text1: 'Upload Failed',
                text2: 'There was a problem uploading your survey. Please try again.',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40,
            });

        } finally {
            setIsUploading(false); // End uploading
        }
    };

  return (
    <View style={localStyles.wrapper}>
        {!isConnected && <Text style={localStyles.networkWarning}>No Network Connection: Upload Not Available</Text>}
        <Text style={localStyles.title}>Ready for Upload</Text>
        {surveys.length === 0 ? (
            <Text>No Completed Surveys Found</Text>
        ) : (
            surveys.map(survey => (
                <TouchableOpacity key={survey.key} onPress={() => uploadHandler(survey.key)}>
                <View style={localStyles.card}>
                    <Text>{survey.surveyName}</Text>
                    <Text>Completed: {new Date(survey.completed).toLocaleString()}</Text>
                    <Text>{survey.count} observations</Text>
                </View>
                </TouchableOpacity>
            ))
        )}
        {isUploading && (
            <View style={localStyles.overlay}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={localStyles.overlayText}>Uploading...</Text>
            </View>
        )}
  </View>
  );

};

const localStyles = StyleSheet.create({
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    wrapper: {
        padding: 10,
        marginTop: 20,
    },
    card: {
        borderWidth: 1,
        borderColor: '#000',
        padding: 10,
        margin: 5,
    },
    networkWarning: {
        color: 'red',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    overlay: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      overlayText: {
        color: 'white',
        marginTop: 20, // Adjust the space between the indicator and the text as needed
      },

});

export default UploadSurveys;