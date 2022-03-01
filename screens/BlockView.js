import React, {useEffect, useState} from 'react';
import { Text, View, ImageBackground, FlatList, Image, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

import {doc, collection, getDoc, getDocs} from 'firebase/firestore';
import db from '../firebase';

function BlockView ({route, navigation}) {
	const [numColumns, setNumColumns] = useState("");
	const [GridListItems, setGridListItems] = useState([]);
	const colRef = collection(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock, 'plants')
	const docRef = doc(db, 'fieldsites', global.selectedSite, 'blocks', global.selectedBlock)

	useEffect(() => {
		const getResult = async() => {
			const docSnap = await getDoc(docRef)
			if(docSnap.exists()){
				setNumColumns(docSnap.data().columns)
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

    // const goToForm = (item) => {
    //     const { navigate } = navigation;
    // 	navigate('FormView', {type: null, data: item});
    // }

	return (
		<View style={styles.container}>  
			<ImageBackground style={styles.container}
				source={require('../assets/plantField.jpg')}>
				<View style={styles.heading}>
					<Text style={styles.textheading}>{global.selectedSite}, {global.selectedBlock}</Text>
				</View>
				<ScrollView style={styles.GridViewRowCol}
					horizontal={true}
					> 
					<FlatList
						data={ (GridListItems.sort((a, b) => a.column-(b.column)).sort((a, b) => a.row-(b.row))) }
						renderItem={ ({item, index}) =>
						<View style = {styles.GridViewContainer}>
							<View style={(item.alive) ? styles.GridViewIcon : styles.GridViewDeadIcon}>
								{item.alive
									? <Text style={styles.textheading} onPress={() => {global.selectedRow = Math.floor(index/numColumns)+1; global.selectedColumn = Math.floor(index%numColumns)+1;global.selectedSpecies=(item.species); navigation.navigate('TaskSelect')}}>{(Math.floor(index/numColumns))+1}x{(index % numColumns)+1}</Text>
									: <Text style={styles.textheading} onPress={() => {global.selectedSpecies=(item.species); navigation.navigate('TaskSelect');}}>DEAD</Text>
								}
							</View>
							<View style={styles.GridViewTextLayout}>
								<Text style={styles.GridViewText}> {item.species} </Text>
							</View>
						</View>}
						numColumns={numColumns}
						key={numColumns}
					/>
				</ScrollView>
			</ImageBackground>
		</View>
	)
}

export default BlockView;