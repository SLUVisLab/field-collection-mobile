import { StyleSheet, Dimensions, Image } from 'react-native';

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
    bottomView: {
      paddingVertical: 12,
      paddingBottom: 10,
      paddingHorizontal: 5,
      borderRadius: 50,
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
    GridViewContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    GridViewIcon: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      borderRadius: 100 / 2,
      margin: 5,
      backgroundColor: 'rgba(255,172,50,1)'
    },
    GridViewDeadIcon: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      borderRadius: 100 / 2,
      margin: 5,
      backgroundColor: 'rgba(255,0,0,1)'
    },
    GridViewTextLayout: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)'
    },
    GridViewText: {
      textAlign: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 0.25,
      color: 'white',
      marginRight: 3,
    },
    GridViewRowCol: {
      marginLeft: 5,
    }
  }); 