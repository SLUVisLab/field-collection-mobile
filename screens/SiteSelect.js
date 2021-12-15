import React, { Component } from 'react';
import { Text, View, ImageBackground, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import { SiteContext } from '../SiteContext';
import styles from '../Styles';

import {ref, set, child, get} from 'firebase/database';
import db from '../firebase';

// For reference: https://stackoverflow.com/questions/43016624/react-native-apply-array-values-from-state-as-picker-items

// write data to the database
// set(ref(db, 'users/' + '12345678'), {
//  username: 'nfgsko',
//  email: 'julia.vmdskvp;s@yadayada.edu'
// });


const dbRef = ref(db);
get(child(dbRef, `sites`)).then((snapshot) => {
  if (snapshot.exists()) {
    Alert.alert('Data', JSON.stringify(snapshot.val()))
  } else {
    Alert.alert('Data', "No data available");
  }
}).catch((error) => {
  Alert.alert('ERROR', error.message);
});

var options = ["Hamad Khan","Julia Pratt","Alexander Juan","Abby Stylianou","Allison Miller"];
class SiteSelect extends Component {
   
   state = {site: ''}
   updateSite = (site) => {
      this.setState({ site: site})
   }
   render() {
      //console.log(options[this.state.site])
      return (
        <View style={styles.container}>   
          <ImageBackground style={styles.container}
            source={require('../assets/plantField.jpg')}>
            <View style={styles.heading}>
              <Text style={styles.textheading}>Please select a site</Text>
            </View> 
            <Picker
              style={styles.picker}
              selectedValue={this.state.site}
              onValueChange={this.updateSite}
              animationType="slide"
              itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
              {options.map((item, index) => {
                return (< Picker.Item label={item} value={index} key={index} />);
              })}   
            </Picker>
            <View style={{height:10}}></View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => { this.context.setSite(options[this.state.site]); this.props.navigation.navigate('TaskSelect'); }}
            >
              <Text style={styles.text}>Go</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => this.props.navigation.navigate('Home')}
            >
              <Text style={styles.text}>Back Home</Text>
            </TouchableOpacity>
          </ImageBackground>
         </View>
      )
   }
}

SiteSelect.contextType = SiteContext;

export default SiteSelect 