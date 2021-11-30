import React, {useState} from 'react';
import { Text, View, ImageBackground, FlatList, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import styles from '../Styles';

export default class PlotView extends React.Component {

constructor(props) {
	super(props);

	this.state = {
    	GridListItems: [
        	{ key: "Plant1" },
        	{ key: "Sumit" },
        	{ key: "Amit" },
        	{ key: "React" },
        	{ key: "React Native" },
        	{ key: "Java" },
        	{ key: "Javascript" },
        	{ key: "PHP" },
        	{ key: "AJAX" },
        	{ key: "Android" },
        	{ key: "Selenium" },
        	{ key: "HTML" },
        	{ key: "Database" },
        	{ key: "MYSQL" },
        	{ key: "SQLLite" },
        	{ key: "Web Technology" },
        	{ key: "CSS" },
        	{ key: "Python" },
        	{ key: "Linux" },
        	{ key: "Kotlin" },
    	]
    };
}

GetGridViewItem(item) {
	Alert.alert(item);
}

render() {
	return (
		<View style={styles.container}>  
			<ImageBackground style={styles.container}
	          source={require('../assets/plantField.jpg')}>
	    	<View style={styles.heading}>
            	<Text style={styles.textheading}>Plot</Text>
        	</View>
		    <FlatList
	 		data={ this.state.GridListItems }
	 		renderItem={ ({item}) =>
	     		<View style={styles.GridViewContainer}>
	       			<Text style={styles.GridViewTextLayout} onPress={this.GetGridViewItem.bind(this, item.key)} > {item.key} </Text>
	     		</View> }
	 		numColumns={4}
			/>
	    	</ImageBackground>
	    </View>
    );
}
}
