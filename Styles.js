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
      margin: 8,
      backgroundColor: 'rgba(255,172,50,1)'
    },
    GridViewDoneIcon: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      borderRadius: 100 / 2,
      margin: 8,
      backgroundColor: 'rgba(0,0,0,0.5)'
    },
    GridViewDeadIcon: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      borderRadius: 100 / 2,
      margin: 8,
      backgroundColor: 'rgba(255,0,0,1)'
    },
    GridViewInfo: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      margin: 8,
      backgroundColor: 'rgba(255,172,50,1)'
    },
    GridViewDeadInfo: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      margin: 8,
      backgroundColor: 'rgba(255,0,0,1)'
    },
    GridViewTextLayout: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 20,
      backgroundColor: 'rgba(0,0,0,0.25)'
    },
    GridViewInfoTextLayout: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 90,
      backgroundColor: 'rgba(0,0,0,0)'
    },
    GridViewTextLayoutClear: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      height: 20,
      backgroundColor: 'rgba(0,0,0,0)'
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
    GridViewInfoText: {
      textAlign: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: 12,
      fontWeight: 'bold',
      letterSpacing: 0.25,
      lineHeight: 16,
      color: 'white',
    },
    GridViewRowCol: {
      backgroundColor: 'rgba(0,0,0,0.1)'
    },
    SlideButtonContainer: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.1)',
    },
    SlideButtonInnerContainer: {
      flexDirection: 'row',
      position: 'relative',
      height: 50,
      width: Dimensions.get('screen').width*0.9,
      margin:8,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.25)',
      marginHorizontal: 5
    },
    SlideButton: {
      position: 'absolute',
      height: 50 - 2*2,
      top: 2,
      bottom: 2,
      borderRadius: 10,
      width: Dimensions.get('screen').width*0.45,
      backgroundColor: 'rgba(255,172,50,0.85)',
    },
    SlideButtonButton: {
      flex: 1,
      width: Dimensions.get('screen').width*0.45,
      justifyContent: 'center',
      alignItems: 'center'
    },
    divider: {
      height: 1,
      marginVertical: 10,
    },
    horizontalLine: {
      borderBottomColor: 'black',
      borderBottomWidth: 1,
      width: deviceWidth * 0.9, // Set width to 90% of the screen width
      alignSelf: 'center', // Align the line to the center horizontally
      marginVertical: 10,
    },
    headerText: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    textInput: {
      backgroundColor: 'white',
      width: '90%',
      borderRadius: 10,
      padding: 10,
      marginVertical: 5,
      alignSelf: 'center',
    },
    inputLabelContainer: {
      width: '90%',
      alignSelf: 'center', // Center the container horizontally
      marginBottom: 5, // Add some spacing between the label and the input field
    },
    inputLabel: {
      fontWeight: 'bold', // Make the text slightly bold
    },
    surveyItemButton: {
      textAlign: 'left',
      paddingVertical: 12,
      marginVertical: 3,
      marginHorizontal: 16,
      paddingHorizontal: 32,
      borderRadius: 3,
      elevation: 3,
      backgroundColor: 'white'
    },
    surveyCollectionButton: {
      textAlign: 'left',
      paddingVertical: 12,
      marginVertical: 3,
      marginHorizontal: 16,
      paddingHorizontal: 32,
      borderRadius: 3,
      elevation: 3,
      backgroundColor: 'white',
    },
    boldText: {
      fontWeight: 'bold',
    },
    spacer: {
      height: 40, // or whatever standard amount of space you want
    },

    loginWrapperTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 60,
    },


  }); 