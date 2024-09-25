import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import styles from '../../Styles';



const ChoiceAction = ({ navigation, existingData, onComplete, task, item, collection }) => {

    const [data, setData] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        navigation.setOptions({ title: task.taskDisplayName });
    }, []);

    useEffect(() => {
        if(task && task.dataLabel && existingData && existingData["data"] && existingData["data"][task.dataLabel] ) {
            console.log("existing task data found")
    
            setData(existingData["data"][task.dataLabel])
        }
    }, [task, existingData]);

    const handleDone = () => {

        onComplete({ [task.dataLabel]: data });
  
    };

    const handlePress = (choice) => {
        setData(choice);
    };

    const renderChoice = ({ item }) => (
      <TouchableOpacity
            style={[
                localStyles.choiceItem,
                data === item && localStyles.selectedItem
            ]}
            onPress={() => handlePress(item)}
        >
            <Text style={localStyles.choiceText}>{item}</Text>
        </TouchableOpacity>
    )


    return (
    <View style={[styles.container, { flex: 1, justifyContent: 'space-between' }]}>
      <View style={localStyles.infoContainer}>
        {collection.parentName && <Text style={localStyles.info}>{collection.parentName}</Text>}
        <Text style={localStyles.info}>{collection.name}</Text>
        <Text style={localStyles.info}>{item.name}</Text>
      </View>
      <View style={{ justifyContent: 'center', flex: 1 }}>
        <View>
            <Text style={localStyles.instructions}>{task.instructions}</Text>
            {/* <TouchableOpacity style={localStyles.helpButton} onPress={() => setShowInstructions(true)}>
                <Text style={localStyles.buttonText}>?</Text>
            </TouchableOpacity> */}
        </View>
        <FlatList
            data={task.options.choices}
            renderItem={renderChoice}
            keyExtractor={(item, index) => index.toString()}
        />
      </View>
      <View>
        <TouchableOpacity
            style={styles.button}
            onPress={handleDone}
            >
            <Text style={styles.text}>Done</Text>
        </TouchableOpacity>
      </View>
        {/* <Modal
          animationType="slide"
          transparent={true}
          visible={showInstructions}
          onRequestClose={() => {
            setShowInstructions(false);
          }}
        >
          <View style={localStyles.centeredView}>
            <View style={localStyles.modalView}>
              <Text style={localStyles.modalText}>{task.instructions}</Text>

              <TouchableOpacity
                style={{ ...localStyles.openButton, backgroundColor: "#2196F3" }}
                onPress={() => {
                  setShowInstructions(false);
                }}
              >
                <Text style={localStyles.textStyle}>Hide Instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal> */}
    </View>
    );
  };

  const localStyles = StyleSheet.create({

    choiceItem: {
      backgroundColor: 'white',
      padding: 10,
      marginVertical: 5,
      marginHorizontal: 10,
      borderRadius: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    selectedItem: {
      backgroundColor: 'lightgreen',
    },
    choiceText: {
      color: 'black',
    },
    instructions: {
      fontSize: 14,
      padding: 10,
    },
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 22
    },
    infoContainer: {
      marginTop: 20,
      marginBottom: 20
    },
    info: {
        fontWeight: 'bold',
        fontSize: 20,
        textAlign: 'center',
    },

  });
  
  export default ChoiceAction;