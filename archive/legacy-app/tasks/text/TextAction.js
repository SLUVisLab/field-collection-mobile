import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Modal, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../../Styles';



const TextAction = ({ existingData, onComplete, task, item, collection }) => {

    const [data, setData] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        if(task && task.dataLabel && existingData && existingData["data"] && existingData["data"][task.dataLabel]) {
            console.log("existing text task data found")
    
            setData(existingData["data"][task.dataLabel])
        }
    }, [task, existingData]);

    const handleDone = () => {

        onComplete({ [task.dataLabel]: data });
  
      };

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { flex: 1, justifyContent: 'space-between' }]}>
          <View style={localStyles.infoContainer}>
            {collection.parentName && <Text style={localStyles.info}>{collection.parentName}</Text>}
            <Text style={localStyles.info}>{collection.name}</Text>
            <Text style={localStyles.info}>{item.name}</Text>
          </View>
          <View style={{ justifyContent: 'center', flex: 1 }}>
            <View style={[styles.inputLabelContainer, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                <Text style={[styles.inputLabel, { alignSelf: 'flex-end' }]}>{task.dataLabel}</Text>
                <TouchableOpacity style={localStyles.helpButton} onPress={() => setShowInstructions(true)}>
                    <Text style={localStyles.buttonText}>?</Text>
                </TouchableOpacity>
            </View>
            <TextInput
                style={styles.textInput}
                value={data}
                onChangeText={setData}
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
          <Modal
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
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const localStyles = StyleSheet.create({
    infoContainer: {
      marginTop: 20,
    },
    info: {
        fontWeight: 'bold',
        fontSize: 20,
        textAlign: 'center',
    },
    helpButton: {
        felx: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
        margin: 10,
      },
      buttonText: {
        color: 'black',
      },
      instructions: {
        color: 'white',
      },
      centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 22
      },
      modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
      },
      openButton: {
        backgroundColor: "#F194FF",
        borderRadius: 20,
        padding: 10,
        elevation: 2
      },

  });
  
  export default TextAction;