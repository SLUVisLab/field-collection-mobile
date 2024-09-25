import Task from '../Task';
import Entypo from '@expo/vector-icons/Entypo';

const taskIcon = ({ style, size = 24 }) => <Entypo name="location" size={size} color="black" style={style} />;

class LocationTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

LocationTask.typeID = 7;
LocationTask.typeDisplayName = 'Location';
LocationTask.typeDescription = "Record Device Location"
LocationTask.typeIcon = taskIcon;
LocationTask.setupViewPath = '#';
LocationTask.actionViewPath = '#';

export default LocationTask;