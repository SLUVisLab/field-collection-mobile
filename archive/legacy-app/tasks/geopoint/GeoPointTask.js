import Task from '../Task';
import Entypo from '@expo/vector-icons/Entypo';

const taskIcon = ({ style, size = 24 }) => <Entypo name="location" size={size} color="black" style={style} />;

class GeoPointTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

GeoPointTask.typeID = 7;
GeoPointTask.typeDisplayName = 'GeoPoint';
GeoPointTask.typeDescription = "Record Device Location as a lat/lon point";
GeoPointTask.typeIcon = taskIcon;
GeoPointTask.setupViewPath = '#';
GeoPointTask.actionViewPath = '#';

export default GeoPointTask;