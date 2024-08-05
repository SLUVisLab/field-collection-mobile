import Task from "../Task.js"
import Octicons from '@expo/vector-icons/Octicons';

const NumberTaskIcon = ({ style, size = 24 }) => <Octicons name="number" size={size} color="black" style={style} />;

class NumberTask extends Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
      super(taskID, taskDisplayName, dataLabel, instructions, options);
    }
  
  
}
  
// Set static properties for PhotoTask
NumberTask.typeID = 3;
NumberTask.typeDisplayName = 'Number';
NumberTask.setupViewPath = '#';
NumberTask.actionViewPath = '#';
NumberTask.typeDescription = "Collect numeric input";
NumberTask.typeIcon = NumberTaskIcon;

export default NumberTask;