import Task from '../Task';
// import PhotoSetup from './PhotoSetup';

class PhotoTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions) {
    super(taskID, taskDisplayName, dataLabel, instructions);
  }


}

// Set static properties for PhotoTask
PhotoTask.typeID = 1;
PhotoTask.typeDisplayName = 'Photo Task';
// PhotoTask.setupViewPath = PhotoSetup;
PhotoTask.actionViewPath = '#';

export default PhotoTask;