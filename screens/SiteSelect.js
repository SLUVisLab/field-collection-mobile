import React, { Component } from 'react';
import { Text, View, ImageBackground } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import { Picker } from '@react-native-picker/picker';

// For reference: https://stackoverflow.com/questions/43016624/react-native-apply-array-values-from-state-as-picker-items

var options = ["Hamad Khan","Julia Pratt","Alexander Juan","Abby Stylianou","Allison Miller"];
class SiteSelect extends Component {
   state = {site: ''}
   updateSite = (site) => {
      this.setState({ user: site})
   }
   render() {
      return (
        <View style={styles.container}>   
          <ImageBackground style={styles.container}
            source={require('../assets/plantField.jpg')}>
            <View
              style={styles.heading}
            >
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
              onPress={() => this.props.navigation.navigate('TaskSelect', {type: null, selectedSite: this.state.site})}
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
export default SiteSelect 