import React, { Component, useEffect, useState } from 'react';
import { Text, View, ImageBackground, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import styles from '../Styles';
import {doc, collection, query, where, getDoc, getDocs} from 'firebase/firestore';
import db from '../firebase';

// For reference: https://stackoverflow.com/questions/62583527/firebase-load-data-on-page-load-instead-of-on-click-react
// For reference: https://stackoverflow.com/questions/43016624/react-native-apply-array-values-from-state-as-picker-items
function SiteSelect ({ route, navigation })  {
  const [siteList, setSiteList] = useState([]);
  const colRef = collection(db, 'fieldsites')
  const [site, setSite] = useState('');


  const updateSite = (sitename) => {
    setSite(sitename);
  }

  useEffect( () => {
    const getSitesFromFirestore = [];
    getDocs(colRef)
      .then( (snapshot) => {
        snapshot.docs.forEach( (doc) => {
          getSitesFromFirestore.push(doc.id)
        })
        setSiteList(getSitesFromFirestore)
      })
      .catch((e) => alert(e))
  }, [])
   
  return (
    <View style={styles.container}>   
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <View style={styles.heading}>
          <Text style={styles.textheading}>Please select a site</Text>
        </View> 
        <Picker
          style={styles.picker}
          selectedValue={site}
          onValueChange={updateSite}
          animationType="slide"
          itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
          {siteList.map((item, index) => {
            return (< Picker.Item label={item} value={index} key={index} />);
          })}   
        </Picker>
        <View style={{height:10}}></View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {global.selectedSite=(siteList[site]); navigation.navigate('BlockSelect'); }}
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

export default SiteSelect;
