import React, {useEffect, useState} from 'react';
import { Text, View, ImageBackground, FlatList, Image, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

import {doc, collection, getDoc, getDocs} from 'firebase/firestore';
import db from '../firebase';

//create your forceUpdate hook
function useForceUpdate(){
    const [value, setValue] = useState(0); // integer state
    return () => setValue(value => value + 1); // update the state to force render
}

function updateDone() {
	var i, j;
    for (i = 0; i < 100; ++i) {
    	for (j = 0; j < 100; ++j) {
        	global.isDone[i][j] = 0;
        }
    }
}

function BlockView ({route, navigation}) {
	const [numColumns, setNumColumns] = useState("");
	const [numRows, setNumRows] = useState("");
	const [GridListItems, setGridListItems] = useState([]);
	const colRef = collection(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock, 'plants');
	const docRef = doc(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock);
	const forceUpdate = useForceUpdate();

  function getUrl(url) {
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

	useEffect(() => {
		const getResult = async() => {
			const docSnap = await getDoc(docRef)
			if(docSnap.exists()){
				setNumColumns(docSnap.data().columns);
				setNumRows(docSnap.data().rows);
			} else {
				alert("Error. Cannot find document.")
			}
		}
		getResult();
	}, []);

	useEffect( () => {
		const grabPlantData = [];

		getDocs(colRef)
			.then( (snapshot) => {
				snapshot.docs.forEach( (doc) => {
					grabPlantData.push({key: doc.id,
										species:doc.data().species,
										row:doc.data().row,
										column:doc.data().column,
										alive:doc.data().alive})
				})
			setGridListItems(grabPlantData)
			})
			.catch( (e) => alert(e))
	}, [])

	return (
		<View style={styles.container}>  
			<ImageBackground style={styles.container}
				source={require('../assets/plantField.jpg')}>
				<View style={styles.heading}>
					<Text style={styles.textheading}>{global.selectedSite}, Block {global.selectedBlock}</Text>
				</View>
				<ScrollView style={styles.GridViewRowCol}
					horizontal={true}
					> 
					<FlatList
						data={ (GridListItems.sort((a, b) => a.column-(b.column)).sort((a, b) => (b.row-a.row))) }
						renderItem={ ({item, index}) =>
						<View style = {styles.GridViewContainer}>
							<View style={(item.alive) 
											? global.isDone[item.row][item.column] == 1
												? styles.GridViewDoneIcon
												: styles.GridViewIcon
											: styles.GridViewDeadIcon
										}>
								{item.alive
									? <Text style={styles.textheading} onPress={() => {global.selectedRow = (item.row); global.selectedColumn = (item.column); global.selectedSpecies=(item.species); global.isDone[item.row][item.column] = 1; forceUpdate(); navigation.navigate("FormView", {type: null, data: getUrl(global.selectedUrl)})}}>{item.column},{item.row}</Text>
									: <Text style={styles.textheading} onPress={() => {global.selectedSpecies=(item.species); navigation.navigate('TaskSelect');}}>DEAD</Text>
								}
							</View>
							<View style={styles.GridViewTextLayout}>
								{global.isDone[item.row][item.column] == 1
									? <Text style={styles.GridViewText}> Done </Text>
									: <Text style={styles.GridViewText}> Not Done </Text>
								}
							</View>
						</View>}
						numColumns={numColumns}
						key={numColumns}
					/>
				</ScrollView>
				<TouchableOpacity style={styles.heading} onPress={() => {updateDone(); forceUpdate(); navigation.navigate("BlockSelect")}}>
					<Text style={styles.textheading}>Finish Walk</Text>
				</TouchableOpacity>
				<View style={styles.bottomView}>
				</View>
			</ImageBackground>
		</View>
	)
}

export default BlockView;