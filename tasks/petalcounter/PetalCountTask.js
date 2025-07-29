import Task from '../Task';
import Ionicons from '@expo/vector-icons/Ionicons';

const CameraTaskIcon = ({ style, size = 24 }) => <Ionicons name="flower-outline" size={size} color="black" style={style} />;

class PetalCountTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

PetalCountTask.typeID = 111;
PetalCountTask.typeDisplayName = 'Petal Counter';
PetalCountTask.typeDescription = "Count the number of petals in a flower by taking a photo.";
PetalCountTask.typeIcon = CameraTaskIcon;
PetalCountTask.setupViewPath = '#';
PetalCountTask.actionViewPath = '#';

export default PetalCountTask;