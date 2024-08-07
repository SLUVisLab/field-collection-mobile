import Task from '../Task';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const taskIcon = ({ style, size = 24 }) => <MaterialIcons name="videocam" size={size} color="black" style={style} />;

class VideoTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

// Set static properties for PhotoTask
PhotoTask.typeID = 5;
PhotoTask.typeDisplayName = 'Video';
PhotoTask.typeDescription = "Record Video with the camera"
PhotoTask.typeIcon = taskIcon;
PhotoTask.setupViewPath = '#';
PhotoTask.actionViewPath = '#';

export default VideoTask;