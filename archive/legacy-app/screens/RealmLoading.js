import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const RealmLoading = () => {

  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowText(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={localStyles.RealmLoadingContainer}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text>Loading...</Text>
      {showText && (
        <Text>If you're stuck here, the app may be struggling to find a network connection.</Text>
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  RealmLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});


export default RealmLoading;