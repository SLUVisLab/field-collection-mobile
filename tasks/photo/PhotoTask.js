import Task from '../Task';
import Ionicons from '@expo/vector-icons/Ionicons';

const CameraTaskIcon = ({ style, size = 24 }) => <Ionicons name="camera" size={size} color="black" style={style} />;

class PhotoTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

PhotoTask.typeID = 1;
PhotoTask.typeDisplayName = 'Photo';
PhotoTask.typeDescription = "Take a single photo with the camera"
PhotoTask.typeIcon = CameraTaskIcon;
PhotoTask.setupViewPath = '#';
PhotoTask.actionViewPath = '#';

export default PhotoTask;