import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import ProgressBar from 'react-native-progress/Bar';
import { format } from 'date-fns';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSurveyData } from '../contexts/SurveyDataContext';

const UploadSurveys = ({ route, navigation }) => {

    const { listAllSavedSurveys, uploadSurvey } = useSurveyData()

    const [surveys, setSurveys] = useState([]);

    useEffect(() => {
        console.log("useEffect called");
        const fetchSurveys = async () => {
          console.log("fetchSurveys called");
          const savedSurveys = await listAllSavedSurveys();
          setSurveys(savedSurveys);
        };
    
        fetchSurveys();
      }, []);

    const uploadHandler = (storageKey) => {
    // Handle upload
    console.log("called upload handler");
    console.log(storageKey);
    
    uploadSurvey(storageKey)
        
    };

  return (
    <View style={localStyles.wrapper}>
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

});

export default UploadSurveys;