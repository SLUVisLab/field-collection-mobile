class Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions, options = {}) {
      this.taskID = taskID;
      this.taskDisplayName = taskDisplayName;
      this.dataLabel = dataLabel;
      this.instructions = instructions;
      this.options = options;

    }
  
    static typeID;
    static typeDisplayName;
    static typeDescription;
    static typeIcon;
    static typeSetupViewPath;
    static typeActionViewPath;
  }
  
  export default Task;