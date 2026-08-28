import Task from '../Task';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const taskIcon = ({ style, size = 24 }) => <MaterialIcons name="videocam" size={size} color="black" style={style} />;

class VideoTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

VideoTask.typeID = 5;
VideoTask.typeDisplayName = 'Video';
VideoTask.typeDescription = "Record Video with the camera"
VideoTask.typeIcon = taskIcon;
VideoTask.setupViewPath = '#';
VideoTask.actionViewPath = '#';

export default VideoTask;