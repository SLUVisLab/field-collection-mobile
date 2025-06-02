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

const MAX_HISTORY_ITEMS = 50;  // Maximum number of completed uploads to keep
const MAX_HISTORY_DAYS = 90;   // Maximum age of history items in days

const UploadSurveys = ({ route, navigation }) => {
    const { 
        listAllSavedSurveys, 
        uploadSurvey, 
        deleteLocalSurveyData, 
        cancelUpload, 
        uploadProgress: contextUploadProgress 
    } = useSurveyData();
    
    const [pendingSurveys, setPendingSurveys] = useState([]);
    const [completedUploads, setCompletedUploads] = useState([]);
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
        
        // Load and filter completed upload history from AsyncStorage
        try {
            const completedData = await AsyncStorage.getItem('@completedUploads');
            if (completedData) {
                const allUploads = JSON.parse(completedData);
                const filteredUploads = applyHistoryLimits(allUploads);
                
                // If we filtered out some items, update the stored data
                if (filteredUploads.length < allUploads.length) {
                    await AsyncStorage.setItem('@completedUploads', JSON.stringify(filteredUploads));
                }
                
                setCompletedUploads(filteredUploads);
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
            
            // Apply limits before saving
            const filteredUploads = applyHistoryLimits(updatedCompletedUploads);
            
            await AsyncStorage.setItem('@completedUploads', JSON.stringify(filteredUploads));
            setCompletedUploads(filteredUploads);
        } catch (error) {
            console.error("Failed to save completed upload", error);
        }
    };

    // Helper function to apply both time and count limits
    const applyHistoryLimits = (uploads) => {
        // Apply time-based filtering
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);
        
        let filtered = uploads.filter(upload => 
            new Date(upload.uploadedAt) >= cutoffDate
        );
        
        // Apply count-based limiting
        if (filtered.length > MAX_HISTORY_ITEMS) {
            filtered = filtered.slice(0, MAX_HISTORY_ITEMS);
        }
        
        return filtered;
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

    // Monitor upload progress and move completed uploads to the completed list
    useEffect(() => {
        // Check for completed uploads
        Object.entries(contextUploadProgress).forEach(([key, status]) => {
            if (status.status === 'completed' && status.progress === 100) {
                // Find the survey in pending surveys
                const completedSurvey = pendingSurveys.find(s => s.key === key);
                if (completedSurvey) {
                    // Save to completed uploads
                    saveCompletedUpload(completedSurvey);
                    
                    // Remove from pending surveys
                    setPendingSurveys(prev => prev.filter(s => s.key !== key));
                    
                    // Show success toast
                    Toast.show({
                        type: 'success',
                        text1: 'Upload Successful',
                        text2: `${completedSurvey.surveyName} has been uploaded successfully.`,
                        position: 'bottom',
                        visibilityTime: 3000,
                        autoHide: true,
                    });
                }
            }
        });
    }, [contextUploadProgress]);

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

        try {
            // Call the upload function from the context
            // It will handle progress updates internally
            await uploadSurvey(survey.key, realm);
        } catch (error) {
            console.error("Upload failed", error);
            
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

    const handleCancelUpload = (surveyKey) => {
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
                // Call the cancelUpload function from context
                cancelUpload(surveyKey);
                
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
        const uploadInfo = contextUploadProgress[survey.key];
        const isActiveUpload = uploadInfo && ['starting', 'preparing', 'uploading', 'saving', 'saving to database', 'cleaning up'].includes(uploadInfo.status);
        const isFailedUpload = uploadInfo && uploadInfo.status === 'failed';
        const isCancelledUpload = uploadInfo && uploadInfo.status === 'cancelled';
        
        return (
            <View key={survey.key} style={localStyles.card}>
                <View style={localStyles.cardContent}>
                    <View style={localStyles.surveyInfo}>
                        <Text style={localStyles.surveyName}>{survey.surveyName}</Text>
                        <Text>Completed: {new Date(survey.completed).toLocaleString()}</Text>
                        <Text>{survey.count} observations</Text>
                        
                        {uploadInfo && (
                            <View style={localStyles.progressContainer}>
                                <Text>Status: {
                                    isCancelledUpload ? 'Cancelled' : 
                                    isFailedUpload ? 'Failed' : 
                                    uploadInfo.status
                                }</Text>
                                
                                {isActiveUpload && (
                                    <View style={localStyles.progressRow}>
                                        <ProgressBar 
                                            progress={uploadInfo.progress / 100} 
                                            width={150} 
                                            color="#0066cc"
                                        />
                                        <Text style={localStyles.progressText}>
                                            {uploadInfo.progress}%
                                        </Text>
                                    </View>
                                )}
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
                    ) : isActiveUpload ? (
                        // Show cancel button only during active upload
                        <TouchableOpacity 
                            style={localStyles.iconButton}
                            onPress={() => handleCancelUpload(survey.key)}
                        >
                            <Ionicons name="stop-circle" size={24} color="#ff6600" />
                        </TouchableOpacity>
                    ) : (
                        // Show upload button when not uploading or after cancel/fail
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
            
            {/* Show retry button only if upload has failed (not when cancelled) */}
            {isFailedUpload && (
                <TouchableOpacity 
                    style={localStyles.retryButton}
                    onPress={() => uploadHandler(survey)}
                >
                    <Text style={localStyles.retryButtonText}>Retry Upload</Text>
                </TouchableOpacity>
            )}
            
            {/* Show a message when cancelled */}
            {isCancelledUpload && (
                <Text style={localStyles.cancelledText}>
                    Upload was cancelled. Click the upload button to try again.
                </Text>
            )}
        </View>
    )};

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

    // Add a handler for clearing history
    const handleClearHistory = () => {
        if (completedUploads.length === 0) return;
        
        Alert.alert(
          'Clear Upload History',
          'Are you sure you want to clear all upload history?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Clear', 
                style: 'destructive',
                onPress: async () => {
                    await AsyncStorage.setItem('@completedUploads', JSON.stringify([]));
                    setCompletedUploads([]);
                    Toast.show({
                        type: 'success',
                        text1: 'History Cleared',
                        text2: 'Upload history has been cleared.',
                        position: 'bottom',
                        visibilityTime: 3000,
                        autoHide: true,
                    });
                }
            },
          ]
        );
    };

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
                <View style={localStyles.sectionHeader}>
                    <Text style={localStyles.sectionTitle}>Completed Uploads</Text>
                </View>
                
                {completedUploads.length === 0 ? (
                    <Text style={localStyles.emptyStateText}>No completed uploads</Text>
                ) : (
                    <>
                        {completedUploads.map(renderCompletedUploadItem)}
                        
                        <TouchableOpacity 
                            style={localStyles.clearHistoryButton}
                            onPress={handleClearHistory}
                        >
                            <Text style={localStyles.clearHistoryText}>Clear History</Text>
                        </TouchableOpacity>
                    </>
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
    },
    cancelledText: {
        color: '#ff6600',
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    clearHistoryButton: {
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    clearHistoryText: {
        color: '#cc0000',
        fontWeight: '500',
    },
});

export default UploadSurveys;