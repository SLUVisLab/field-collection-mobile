import Task from "../Task.js"
import Ionicons from '@expo/vector-icons/Ionicons';

const TextTaskIcon = ({ style, size = 24 }) => <Ionicons name="text" size={size} color="black" style={style} />;

class TextTask extends Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions) {
      super(taskID, taskDisplayName, dataLabel, instructions);
    }
  
  
}
  
// Set static properties for PhotoTask
TextTask.typeID = 2;
TextTask.typeDisplayName = 'Text';
TextTask.setupViewPath = '#';
TextTask.actionViewPath = '#';
TextTask.typeDescription = "Collect short text or numeric input";
TextTask.typeIcon = TextTaskIcon;

export default TextTask;