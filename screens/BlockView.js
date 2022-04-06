import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ImageBackground, Animated, Dimensions, FlatList, Image, ScrollView, SafeAreaView } from 'react-native';
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
	const [active, setActive] = useState(false);
	let transformX = useRef(new Animated.Value(0)).current;
	const [mode, setMode] = useState(false);
	const [numColumns, setNumColumns] = useState("");
	const [numRows, setNumRows] = useState("");
	const [GridListItems, setGridListItems] = useState([]);
	const colRef = collection(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock, 'plants');
	const docRef = doc(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock);
	const forceUpdate = useForceUpdate();

  function getUrl(url) {
    var first = true;
    var result = ''
    var queue = global.selectedSite+"_"+global.selectedBlock.slice(-1)+"_"+global.selectedRow+"_"+global.selectedColumn;
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
          result += queue;
          continue;
        }
      }
     result += url[i];
    }
    
    return result;
  }

  const rotationX = transformX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Dimensions.get('screen').width*0.45]
  })

  useEffect(() => {
    if (active) {
      Animated.timing(transformX, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start()
    } else {
      Animated.timing(transformX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start()
    }
  }, [active]);

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
				<SafeAreaView style={styles.SlideButtonContainer}>
					<View style={styles.SlideButtonInnerContainer}>
		        <Animated.View
		          style={{
		          	position: 'absolute',
					      height: 50 - 2*2,
					      top: 2,
					      bottom: 2,
					      borderRadius: 10,
					      width: Dimensions.get('screen').width*0.45,
					      backgroundColor: 'rgba(255,172,50,0.85)',
		            transform: [
              		{
                		translateX: rotationX
              		}
            		],
		          }}
		        >
		        </Animated.View>
		        <TouchableOpacity style={styles.SlideButtonButton} onPress={() => {setActive(false); setMode(false)}}>
		          <Text style = {styles.text}>
		            Walk
		        	</Text>
		        </TouchableOpacity>
		        <TouchableOpacity style={styles.SlideButtonButton} onPress={() => {setActive(true); setMode(true)}}>
		          <Text style = {styles.text}>
		            Info
		        	</Text>
		        </TouchableOpacity>
		      </View>
	      </SafeAreaView>
	      {mode
					?	<ScrollView style={styles.GridViewRowCol}
							horizontal={true}
							> 
							<FlatList
								data={ (GridListItems.sort((a, b) => a.column-(b.column)).sort((a, b) => (b.row-a.row))) }
								renderItem={ ({item, index}) =>
								<View style = {styles.GridViewContainer}>
									<View style={(item.alive) 
													? styles.GridViewInfo
													: styles.GridViewDeadInfo
									}>
										<View style={styles.GridViewInfoTextLayout}>
											<Text style={styles.GridViewInfoText}>{item.column},{item.row}{'\n'}{(item.species.split(" "))[0]}{'\n'}{(item.species.split(" "))[1]}{'\n'}Days Since: 0{'\n'}Last: 0</Text>
										</View>
									</View>
									<View style={styles.GridViewTextLayoutClear}>
									</View>
								</View>}
								numColumns={numColumns}
								key={numColumns}
							/>
						</ScrollView>
					:	<ScrollView style={styles.GridViewRowCol}
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
											? <Text style={styles.textheading} onPress={() => {global.selectedRow = (item.row); global.selectedColumn = (item.column); global.selectedSpecies=(item.species); setTimeout(() => {global.isDone[item.row][item.column] = 1; forceUpdate();}, 500); navigation.navigate("FormView", {type: null, data: getUrl(global.selectedUrl)})}}>{item.column},{item.row}</Text>
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
				}
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