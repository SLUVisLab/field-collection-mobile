import React, { Component } from 'react';
import { Text, View, ImageBackground, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import { SiteContext } from '../SiteContext';
import styles from '../Styles';

var options = ["", "Block 1","Block 2","Block 3","Block 4","Block 5"];
class BlockSelect extends Component {
   
   state = {block: ''}
   updateBlock = (block) => {
      this.setState({ block: block})
   }
   render() {
      //console.log(options[this.state.site])
      return (
        <View style={styles.container}>   
          <ImageBackground style={styles.container}
            source={require('../assets/plantField.jpg')}>
            <View style={styles.heading}>
              <Text style={styles.textheading}>Please select from the list of available blocks at {this.context.selectedSite}</Text>
            </View> 
            <Picker
              style={styles.picker}
              selectedValue={this.state.block}
              onValueChange={this.updateBlock}
              animationType="slide"
              itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
              {options.map((item, index) => {
                return (< Picker.Item label={item} value={index} key={index} />);
              })}   
            </Picker>
            <View style={{height:10}}></View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => { this.context.setBlock(options[this.state.block]); this.props.navigation.navigate('BlockView'); }}
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

BlockSelect.contextType = SiteContext;

export default BlockSelect 