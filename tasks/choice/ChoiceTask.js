import Task from "../Task.js"
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const ChoiceTaskIcon = ({ style, size = 24 }) => <MaterialCommunityIcons name="format-list-checks" size={size} color="black" style={style} />;

class ChoiceTask extends Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
        super(taskID, taskDisplayName, dataLabel, instructions, options);
      
        if (!options.choices || !Array.isArray(options.choices) || options.choices.length === 0) {
            throw new Error('ChoiceTask requires an array of choices');
        }
        
        //TODO: this seems like duplicate logic if options is passed to the super constructor
        this.choices = options.choices;
    }
  
  
}
  
// Set static properties for PhotoTask
ChoiceTask.typeID = 4;
ChoiceTask.typeDisplayName = 'Choice';
ChoiceTask.setupViewPath = '#';
ChoiceTask.actionViewPath = '#';
ChoiceTask.typeDescription = "Choose one from a list of options";
ChoiceTask.typeIcon = ChoiceTaskIcon;

export default ChoiceTask;