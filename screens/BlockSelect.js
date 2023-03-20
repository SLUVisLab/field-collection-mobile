import React, { Component, useEffect, useState } from 'react';
import { Text, View, ImageBackground, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import styles from '../Styles';


import {doc, collection, query, where, getDoc, getDocs} from 'firebase/firestore';
import db from '../firebase';

function BlockSelect ({route, navigation}) {
  const [blockList, setBlockList] = useState([]);
  const colRef = collection(db, 'fieldsites', global.selectedSite, 'blocks')
  const [block, setBlock] = useState('');

  const updateBlock = (block) => {
    setBlock(block);
  }

  useEffect( () => {
    const getBlocksFromFirestore = [];
    getBlocksFromFirestore.push('');
    getDocs(colRef)
      .then( (snapshot) => {
        snapshot.docs.forEach( (doc) => {
          getBlocksFromFirestore.push(doc.id)
        })
      setBlockList(getBlocksFromFirestore)
      })
      .catch( (e) => alert(e))
  }, [])

  return (
    <View style={styles.container}>
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <View style={styles.heading}>
          <Text style={styles.textheading}>Please select from the list of available blocks at {global.selectedSite}</Text>
        </View>
        <Picker
          style={styles.picker}
          selectedValue={block}
          onValueChange={updateBlock}
          animationType="slide"
          itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
          {blockList.map((item, index) => {
            return (< Picker.Item label={item} value={index} key={index} />);
          })}
        </Picker>
        <View style={{height:10}}></View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => { global.selectedBlock=(blockList[block]); navigation.navigate('BlockView'); }}
        >
          <Text style={styles.text}>Go</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.text}>Back Home</Text>
        </TouchableOpacity>
      </ImageBackground>
      </View>
  )
}

export default BlockSelect;
