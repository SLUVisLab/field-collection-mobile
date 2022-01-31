import React, {useState} from 'react';
import { Text, View, ImageBackground, FlatList, Image, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SiteContext } from '../SiteContext';
import styles from '../Styles';

export default class BlockView extends React.Component {

    constructor(props) {
    	super();

    	this.state = {
            numColumns: 3,

            numRows: 3,

        	GridListItems: [
            	{ key: 'Plant1', species: 'daisy', row: 3, column: 1, alive: 1 },
                { key: 'Plant2', species: '1,2', row: 1, column: 2, alive: 0 },
                { key: 'Plant3', species: 'potato', row: 1, column: 3, alive: 1 },
                { key: 'Plant4', species: 'daisy', row: 2, column: 1, alive: 1 },
                { key: 'Plant5', species: 'strawberry', row: 2, column: 3, alive: 1 },
                { key: 'Plant6', species: '3,3', row: 3, column: 3, alive: 0 },
                { key: 'Plant7', species: 'daisy', row: 3, column: 2, alive: 1 },
                { key: 'Plant8', species: '3,1', row: 1, column: 1, alive: 1 },
                { key: 'Plant9', species: '2,2', row: 2, column: 2, alive: 1 },
        	]
        };
    }

    goToForm(item) {
        const { navigate } = this.props.navigation;
    	navigate('FormView', {type: null, data: item});
    }

    render() {
    	return (
    		<View style={styles.container}>  
    			<ImageBackground style={styles.container}
    	         	source={require('../assets/plantField.jpg')}>
	    	    	<View style={styles.heading}>
	                	<Text style={styles.textheading}>{this.context.selectedSite}, {this.context.selectedBlock}</Text>
	            	</View>
	            	<ScrollView style={styles.GridViewRowCol}
	            		horizontal={true}
	            		> 
		    		    <FlatList
		    	 			data={ (this.state.GridListItems.sort((a, b) => a.column-(b.column)).sort((a, b) => a.row-(b.row))) }
		    	 			renderItem={ ({item, index}) =>
		                    <View style = {styles.GridViewContainer}>
		        	     		<View style={(item.alive) ? styles.GridViewIcon : styles.GridViewDeadIcon}>
                                    {item.alive
		                                ? <Text style={styles.textheading} onPress={() => this.props.navigation.navigate('TaskSelect')}>{(Math.floor(index/this.state.numColumns))+1}x{(index % this.state.numColumns)+1}</Text>
                                        : <Text style={styles.textheading} onPress={() => this.props.navigation.navigate('TaskSelect')}>DEAD</Text>
                                    }
		        	     		</View>
		                        <View style={styles.GridViewTextLayout}>
		                            <Text style={styles.GridViewText}> {item.species} </Text>
		                        </View>
		                    </View>}
		    	 			numColumns={this.state.numColumns}
		    			/>
		    		</ScrollView>
		    		<View style={styles.bottomView}>
		            	<TouchableOpacity style={styles.button}
			    			onPress={() => this.props.navigation.navigate('Camera')}>
		                	<Text style={styles.text}>New Block</Text>
		            	</TouchableOpacity>
	            	</View>
    	    	</ImageBackground>
    	    </View>
        );
    }
}

BlockView.contextType = SiteContext;
