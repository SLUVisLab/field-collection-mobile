import Task from '../Task';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const taskIcon = ({ style, size = 24 }) => <MaterialCommunityIcons name="vector-selection" size={size} color="black" style={style} />;

class ImageSegmentationTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }

}

ImageSegmentationTask.typeID = 8;
ImageSegmentationTask.typeDisplayName = 'Image Segmentation';
ImageSegmentationTask.typeDescription = "Divide an image into segments";
ImageSegmentationTask.typeIcon = taskIcon;
ImageSegmentationTask.setupViewPath = '#';
ImageSegmentationTask.actionViewPath = '#';

export default ImageSegmentationTask;