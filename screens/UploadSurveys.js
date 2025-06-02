import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import styles from '../Styles';
import Toast from 'react-native-toast-message';
import ProgressBar from 'react-native-progress/Bar';
import { format } from 'date-fns';
import {useRealm} from '@realm/react';
import 'react-native-get-random-values';
import Ionicons from '@expo/vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSurveyData } from '../contexts/SurveyDataContext';

const UploadSurveys = ({ route, navigation }) => {
    const { listAllSavedSurveys, uploadSurvey, deleteLocalSurveyData } = useSurveyData();
    const [pendingSurveys, setPendingSurveys] = useState([]);
    const [completedUploads, setCompletedUploads] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [isConnected, setIsConnected] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);

    const realm = useRealm();

    const toggleEditMode = () => setIsEditMode(!isEditMode);

    // Function to exit edit mode
    const exitEditMode = () => {
        if (isEditMode) {
            setIsEditMode(false);
        }
    };

    // Load pending surveys and completed upload records
    const fetchSurveys = async () => {
        // Fetch surveys ready for upload
        const savedSurveys = await listAllSavedSurveys();
        setPendingSurveys(savedSurveys);
        
        // Load completed upload history from AsyncStorage
        try {
            const completedData = await AsyncStorage.getItem('@completedUploads');
            if (completedData) {
                setCompletedUploads(JSON.parse(completedData));
            }
        } catch (error) {
            console.error("Failed to load completed uploads", error);
        }
    };

    // Save completed uploads to AsyncStorage
    const saveCompletedUpload = async (survey) => {
        try {
            const updatedCompletedUploads = [
                {
                    surveyName: survey.surveyName,
                    uploadedAt: new Date().toISOString(),
                    observationCount: survey.count,
                    id: survey.key
                },
                ...completedUploads
            ];
            
            await AsyncStorage.setItem('@completedUploads', JSON.stringify(updatedCompletedUploads));
            setCompletedUploads(updatedCompletedUploads);
        } catch (error) {
            console.error("Failed to save completed upload", error);
        }
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

    const uploadHandler = async (survey) => {
        if (!isConnected) {
            Toast.show({
                type: 'error',
                text1: 'You are offline',
                text2: 'Please connect to the internet to upload surveys.',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
            });
            return;
        }

        // Initialize progress for this survey
        setUploadProgress(prev => ({
            ...prev,
            [survey.key]: { status: 'preparing', progress: 0 }
        }));

        try {
            // This is where we would update the uploadSurvey function to report progress
            // For now, we'll simulate progress updates
            setUploadProgress(prev => ({
                ...prev,
                [survey.key]: { status: 'uploading media', progress: 20 }
            }));

            // Delay to simulate upload progress
            await new Promise(resolve => setTimeout(resolve, 1000));
            setUploadProgress(prev => ({
                ...prev,
                [survey.key]: { status: 'uploading media', progress: 60 }
            }));

            await uploadSurvey(survey.key, realm); 
            
            // Mark upload as complete
            setUploadProgress(prev => ({
                ...prev,
                [survey.key]: { status: 'completed', progress: 100 }
            }));

            // Save to completed uploads
            await saveCompletedUpload(survey);
            
            // Remove from pending surveys
            setPendingSurveys(pendingSurveys.filter(s => s.key !== survey.key));

            Toast.show({
                type: 'success',
                text1: 'Upload Successful',
                text2: `${survey.surveyName} has been uploaded successfully.`,
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
            });
            
        } catch (error) {
            console.error("Upload failed", error);
            setUploadProgress(prev => ({
                ...prev,
                [survey.key]: { status: 'failed', progress: 0 }
            }));
            
            Toast.show({
                type: 'error',
                text1: 'Upload Failed',
                text2: 'There was a problem uploading your survey. Please try again.',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
            });
        }
    };

    const handleDeleteSurveyData = (key) => {
        Alert.alert(
          'Delete Saved Survey Data',
          'Are you sure you want to delete this survey data?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Delete',
              onPress: async () => {
                await deleteLocalSurveyData(key);
                setPendingSurveys(pendingSurveys.filter(survey => survey.key !== key));
              },
            },
          ],
          { cancelable: false }
        );
    };

    const cancelUpload = (surveyKey) => {
        Alert.alert(
          'Cancel Upload',
          'Are you sure you want to cancel this upload?',
          [
            {
              text: 'No',
              style: 'cancel',
            },
            {
              text: 'Yes, Cancel',
              onPress: () => {
                // Reset the upload progress for this survey
                setUploadProgress(prev => {
                  const updated = {...prev};
                  delete updated[surveyKey];
                  return updated;
                });
                
                // Later we'll need to add actual cancellation logic in the context provider
                Toast.show({
                  type: 'info',
                  text1: 'Upload Cancelled',
                  text2: 'The upload has been cancelled.',
                  position: 'bottom',
                  visibilityTime: 3000,
                  autoHide: true,
                });
              },
            },
          ],
          { cancelable: false }
        );
    };

    // Render a pending survey item
    const renderPendingSurveyItem = (survey) => {
        const isUploading = uploadProgress[survey.key];
        
        return (
            <View key={survey.key} style={localStyles.card}>
                <View style={localStyles.cardContent}>
                    <View style={localStyles.surveyInfo}>
                        <Text style={localStyles.surveyName}>{survey.surveyName}</Text>
                        <Text>Completed: {new Date(survey.completed).toLocaleString()}</Text>
                        <Text>{survey.count} observations</Text>
                        
                        {isUploading && (
                            <View style={localStyles.progressContainer}>
                                <Text>Status: {uploadProgress[survey.key].status}</Text>
                                <View style={localStyles.progressRow}>
                                    <ProgressBar 
                                        progress={uploadProgress[survey.key].progress / 100} 
                                        width={150} 
                                        color="#0066cc"
                                    />
                                    <Text style={localStyles.progressText}>
                                        {uploadProgress[survey.key].progress}%
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                    
                    <View style={localStyles.buttonContainer}>
                        {isEditMode ? (
                            <TouchableOpacity 
                                style={localStyles.iconButton}
                                onPress={() => handleDeleteSurveyData(survey.key)}
                            >
                                <Ionicons name="close-circle" size={24} color="red" />
                            </TouchableOpacity>
                        ) : isUploading ? (
                            <TouchableOpacity 
                                style={localStyles.iconButton}
                                onPress={() => cancelUpload(survey.key)}
                            >
                                <Ionicons name="stop-circle" size={24} color="#ff6600" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={localStyles.iconButton}
                                onPress={() => uploadHandler(survey)}
                                disabled={!isConnected}
                            >
                                <Ionicons name="cloud-upload" size={24} color={isConnected ? "#0066cc" : "#cccccc"} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                
                {/* Show retry button if upload failed */}
                {isUploading && uploadProgress[survey.key].status === 'failed' && (
                    <TouchableOpacity 
                        style={localStyles.retryButton}
                        onPress={() => uploadHandler(survey)}
                    >
                        <Text style={localStyles.retryButtonText}>Retry Upload</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // Render a completed upload item
    const renderCompletedUploadItem = (upload) => (
        <View key={upload.id} style={localStyles.completedCard}>
            <View style={localStyles.cardContent}>
                <View style={localStyles.surveyInfo}>
                    <Text style={localStyles.surveyName}>{upload.surveyName}</Text>
                    <Text>Uploaded: {new Date(upload.uploadedAt).toLocaleString()}</Text>
                    <Text>{upload.observationCount} observations</Text>
                </View>
                <View style={localStyles.buttonContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="green" />
                </View>
            </View>
        </View>
    );

    return (
        <ScrollView style={localStyles.container}>
            {!isConnected && (
                <Text style={localStyles.networkWarning}>
                    No Network Connection: Upload Not Available
                </Text>
            )}
            
            <View style={localStyles.section}>
                <Text style={localStyles.sectionTitle}>Ready for Upload</Text>
                {pendingSurveys.length === 0 ? (
                    <Text style={localStyles.emptyStateText}>No surveys awaiting upload</Text>
                ) : (
                    pendingSurveys.map(renderPendingSurveyItem)
                )}
            </View>
            
            <View style={localStyles.section}>
                <Text style={localStyles.sectionTitle}>Completed Uploads</Text>
                {completedUploads.length === 0 ? (
                    <Text style={localStyles.emptyStateText}>No completed uploads</Text>
                ) : (
                    completedUploads.map(renderCompletedUploadItem)
                )}
            </View>
            
            {isEditMode && (
                <TouchableOpacity 
                    style={localStyles.exitEditModeButton}
                    onPress={exitEditMode}
                >
                    <Text style={localStyles.exitEditModeText}>Done</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    networkWarning: {
        color: 'red',
        fontWeight: 'bold',
        padding: 10,
        backgroundColor: '#ffeeee',
        borderRadius: 5,
        marginBottom: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    completedCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#f9f9f9',
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    surveyInfo: {
        flex: 1,
    },
    surveyName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    buttonContainer: {
        justifyContent: 'center',
        paddingLeft: 10,
    },
    iconButton: {
        padding: 4,
    },
    progressContainer: {
        marginTop: 8,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    progressText: {
        marginLeft: 10,
        fontWeight: 'bold',
    },
    emptyStateText: {
        textAlign: 'center',
        color: '#888',
        fontStyle: 'italic',
        padding: 20,
    },
    exitEditModeButton: {
        backgroundColor: '#0066cc',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    exitEditModeText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    retryButton: {
        backgroundColor: '#0066cc',
        padding: 8,
        borderRadius: 4,
        marginTop: 8,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});

export default UploadSurveys;