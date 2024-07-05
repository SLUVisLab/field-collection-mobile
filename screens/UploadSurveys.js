import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import ProgressBar from 'react-native-progress/Bar';
import { format } from 'date-fns';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSurveyData } from '../contexts/SurveyDataContext';

const UploadSurveys = ({ route, navigation }) => {

    const { listAllSavedSurveys, uploadSurvey } = useSurveyData()
    const [surveys, setSurveys] = useState([]);
    const [isConnected, setIsConnected] = useState(true);

    useEffect(() => {
        
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
            if (!state.isConnected) {
                Alert.alert("Offline", "Uploads are disabled while offline.");
            }
        });

        const fetchSurveys = async () => {
          console.log("fetchSurveys called");
          const savedSurveys = await listAllSavedSurveys();
          setSurveys(savedSurveys);
        };
    
        fetchSurveys();

        return () => unsubscribe();
    }, []);

    const uploadHandler = (storageKey) => {
        if (!isConnected) {
            Toast.show({
                type: 'error',
                text1: 'You are offline',
                text2: 'Please connect to the internet to upload surveys.'
            });
            return;
        }
        console.log("called upload handler");
        console.log(storageKey);

        uploadSurvey(storageKey);
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
                    <Text>{new Date(survey.completed).toLocaleString()}</Text>
                    <Text>{survey.count} observations</Text>
                </View>
                </TouchableOpacity>
            ))
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

});

export default UploadSurveys;