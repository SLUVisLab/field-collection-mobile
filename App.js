import React from 'react';
import { StyleSheet, Text, Button, View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const deviceHeight = Dimensions.get('window').height;
const deviceWidth = Dimensions.get('window').width;

export default function FormView() {
  return (
    <View style={{ flex: 1, alignItems: 'flex-end' }}>
      <WebView 
      source= {{ uri: 'https://docs.google.com/forms/d/e/1FAIpQLSfIvIoFyEUeNeuH-XpwNBKjojoTINopXElLx8kG95zPR85TiA/viewform?usp=sf_link'}}
      style={styles.webview}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={false}
      scalesPageToFit={true}
      />
    </View>
  );
}


const styles = StyleSheet.create({
    pageNatureQuest:{
      flex:1,
      flexDirection:'column',
      alignItems:'center',
    },
    headerContainer: {
      width:'100%',
      backgroundColor:'#ededed',
      },

    webview: {
      flex: 1,
      backgroundColor: 'yellow',
      width: deviceWidth,
      height: deviceHeight
    }
  }); 