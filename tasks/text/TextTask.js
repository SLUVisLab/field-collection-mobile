import Task from "../Task.js"

class TextTask extends Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions) {
      super(taskID, taskDisplayName, dataLabel, instructions);
    }
  
  
}
  
// Set static properties for PhotoTask
TextTask.typeID = 2;
TextTask.typeDisplayName = 'Text Task';
TextTask.setupViewPath = '#';
TextTask.actionViewPath = '#';

export default TextTask;