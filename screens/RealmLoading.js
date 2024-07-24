import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const RealmLoading = () => {
  return (
    <View style={localStyles.RealmLoadingContainer}>
      <ActivityIndicator size="large" color="#0000ff" />
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