import React, {useState, useEffect} from 'react';
import { StyleSheet, Text, Button, View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BarCodeScanner } from 'expo-barcode-scanner';

const deviceHeight = Dimensions.get('window').height;
const deviceWidth = Dimensions.get('window').width;

function HomeScreen({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Button
        title="Go to Camera"
        onPress={() => navigation.navigate('Camera')}
        />

      <Button
        title="Go to FormView"
        onPress={() => navigation.navigate('FormView')}
        />
    </View>
  );
}

function QRCode({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    // Right now, it just goes to the form view no matter what barcode is scanned
    navigation.navigate('FormView')
    // alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      {scanned && <Button title={'Tap to Scan Again'} onPress={() => setScanned(false)} />}
    </View>
  );
}

function FormView({ navigation }) {
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

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="FormView" component={FormView} />
        <Stack.Screen name="Camera" component={QRCode} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
    },
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

export default App;