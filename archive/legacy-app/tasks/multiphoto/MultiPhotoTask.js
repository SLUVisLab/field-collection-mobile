import Task from '../Task';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const taskIcon = ({ style, size = 24 }) => <MaterialCommunityIcons name="camera-burst" size={size} color="black" style={style} />;

class MultiPhotoTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }

}

MultiPhotoTask.typeID = 6;
MultiPhotoTask.typeDisplayName = 'MultiPhoto';
MultiPhotoTask.typeDescription = "Take multiple photos with the camera"
MultiPhotoTask.typeIcon = taskIcon;
MultiPhotoTask.setupViewPath = '#';
MultiPhotoTask.actionViewPath = '#';

export default MultiPhotoTask;