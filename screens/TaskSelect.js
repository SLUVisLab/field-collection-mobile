import React, { Component, useEffect, useState } from 'react';
import { Text, View, ImageBackground, TouchableHighlightBase } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';
import {Picker} from '@react-native-picker/picker';

import {doc, collection, query, where, getDoc, getDocs} from 'firebase/firestore';
import db from '../firebase';

// For reference: https://stackoverflow.com/questions/43016624/react-native-apply-array-values-from-state-as-picker-items
var options = {};


function TaskSelect ({route, navigation}) {
  const [taskList, setTaskList] = useState([]);
  const [task, setTask] = useState('');

  const updateTask = (taskname) => {
    setTask(taskname);
  }
  const colRef = collection(db, 'fieldsites', global.selectedSite, 'tasks')
  //const q = query(colRef, where("allow", "array-contains", global.selectedSpecies));

  function parseJson(jsonObject) {
    for (var i = 0; i < jsonObject.length; i++) {
      options[jsonObject[i].url] = jsonObject[i].name;
    }
  }

  function getString(url) {
    var first = true;
    var result = ''
    var queue = [global.selectedSite, global.selectedBlock.slice(-1), global.selectedRow, global.selectedColumn];
    for (var i = 0; i < url.length; i++) {
      if (url[i] == '=') {
        if (first) {
           result += '=';
           first = false;
           continue;
        } else {
          result += '=';
          while (i < url.length && url[i+1] != '&') {
            i++;
          }
          result += queue.shift();
          continue;
        }
      }
     result += url[i];
    }
     return result;
  }

  useEffect( () => {
    const jsonFromDB = []
    getDocs(colRef)
      .then( (snapshot) => {
        snapshot.docs.forEach( (doc) => {
          jsonFromDB.push({url:doc.data().url, name:doc.id})
        })
        parseJson(jsonFromDB);
        setTaskList(options);
      })
      .catch( (e) => alert(e))
  }, [])

  return (
    <View style={styles.container}>   
      <ImageBackground style={styles.container}
        source={require('../assets/plantField.jpg')}>
        <View
          style={styles.heading}
        >
        <Text style={styles.textheading}>Please select from the list of tasks available at {global.selectedSite} </Text>
        </View> 
        <Picker
        style={styles.picker}
        selectedValue={task}
        onValueChange={updateTask}
        animationType="slide"
        itemStyle={{ color:"white", fontWeight:"bold", fontSize:20 }}>
          {Object.keys(taskList).map((key) => {
                return (<Picker.Item label={taskList[key]} value={key} key={key}/>) //if you have a bunch of keys value pair
              })}
        </Picker>
        <View style={{height:10}}></View>
      <TouchableOpacity
          style={styles.button}
          onPress={() => {global.selectedUrl = task; global.selectedTask=(taskList[task]); navigation.navigate("BlockSelect")}}
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

export default TaskSelect;
