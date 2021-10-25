import { StyleSheet, Dimensions } from 'react-native';

const deviceHeight = Dimensions.get('window').height;
const deviceWidth = Dimensions.get('window').width;

export default StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
    },
    cameraview: {
      flex: 1,
      justifyContent: 'center',
    },
    webview: {
      flex: 1,
      backgroundColor: 'white',
      width: deviceWidth,
      height: deviceHeight
    },
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      paddingVertical: 12,
      marginVertical: 3,
      marginHorizontal: 16,
      paddingHorizontal: 32,
      borderRadius: 4,
      elevation: 3,
      backgroundColor: 'rgba(255,172,50,0.85)'
    },
    heading: {
      paddingVertical: 12,
      marginVertical: 12,
      marginHorizontal: 16,
      paddingHorizontal: 32,
      borderRadius: 4,
      elevation: 3,
      backgroundColor: 'rgba(255,172,50,0.85)'
    },
    text: {
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 21,
      fontWeight: 'bold',
      letterSpacing: 0.25,
      color: 'white',
    },
    textheading: {
      textAlign: 'center',
      fontSize: 24,
      lineHeight: 32,
      paddingVertical: 5,
      fontWeight: 'bold',
      letterSpacing: 0.25,
      color: 'rgb(255,255,255)'
    },
    picker: {
      height: 175,
      marginHorizontal: 16,
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 4,
      backgroundColor: 'rgba(255,172,50,0.85)'
    },
  }); 