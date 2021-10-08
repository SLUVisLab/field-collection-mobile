import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import styles from './Styles';

function FormView({ route, navigation }) {
    const { type, data } = route.params;
    return (
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <WebView 
        source= {{ uri: data}}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        />
      </View>
    );
}

export default FormView;  