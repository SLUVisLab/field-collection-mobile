import React, {useState} from 'react';
import { Text, View, ImageBackground, FlatList, Image, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SiteContext } from '../SiteContext';
import styles from '../Styles';

export default class PlotView extends React.Component {

    constructor(props) {
    	super();

    	this.state = {
        	GridListItems: [
            	{ key: "Plant1", url: 'https://docs.google.com/forms/d/e/1FAIpQLScgcGUPmOHeMXARUQR6JusG0nHWdoDazscBUwajP3Z9x7tMsQ/viewform?usp=pp_url&entry.1022705470=1&entry.95574452=1'},
            	{ key: "Plant2", url: 'https://docs.google.com/forms/d/e/1FAIpQLScgcGUPmOHeMXARUQR6JusG0nHWdoDazscBUwajP3Z9x7tMsQ/viewform?usp=pp_url&entry.1022705470=1&entry.95574452=2'},
            	{ key: "Plant3", url: 'https://docs.google.com/forms/d/e/1FAIpQLScgcGUPmOHeMXARUQR6JusG0nHWdoDazscBUwajP3Z9x7tMsQ/viewform?usp=pp_url&entry.1022705470=1&entry.95574452=3'},
            	{ key: "Plant4", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
            	{ key: "Plant5", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant6", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant7", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant8", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
            	{ key: "Plant9", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant10", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant11", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant12", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
            	{ key: "Plant13", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant14", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant15", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant16", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
            	{ key: "Plant17", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant18", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant19", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
                { key: "Plant20", url: 'https://docs.google.com/spreadsheets/d/1QxCk3aqvCFH-5X4OWYPcuK7v0Hf4iyc8g6wsUtKklb8/edit#gid=0'},
        	]
        };
    }

    goToForm(item) {
        const { navigate } = this.props.navigation;
    	navigate('TaskSelect', {type: null, data: item});
    }

    render() {
    	return (
    		<View style={styles.container}>  
    			<ImageBackground style={styles.container}
    	         	source={require('../assets/plantField.jpg')}>
	    	    	<View style={styles.heading}>
	                	<Text style={styles.textheading}>Plot X, {this.context.selectedTask}</Text>
	            	</View>
	            	<ScrollView style={styles.GridViewRowCol}
	            		horizontal={true}
	            		> 
		    		    <FlatList
		    	 			data={ this.state.GridListItems }
		    	 			renderItem={ ({item}) =>
		                    <View style = {styles.GridViewContainer}>
		        	     		<View style={styles.GridViewIcon}>
		                            <Image
		                                style={{                      
		                                width: '60%',
		                                height: undefined,
		                                aspectRatio: 1,                      
		                                }}
		                                source={require("../assets/plantIcon.png")}
		                            />
		        	     		</View> 
		                        <View style={styles.GridViewTextLayout}>
		                            <Text style={styles.GridViewText} onPress={this.goToForm.bind(this, item.url)} > {item.key} </Text>
		                        </View>
		                    </View>}
		    	 			numColumns={5}
		    			/>
		    		</ScrollView>
		    		<View style={styles.bottomView}>
		            	<TouchableOpacity style={styles.button}
			    			onPress={() => this.props.navigation.navigate('Camera')}>
		                	<Text style={styles.text}>New Plot</Text>
		            	</TouchableOpacity>
	            	</View>
    	    	</ImageBackground>
    	    </View>
        );
    }
}

PlotView.contextType = SiteContext;
