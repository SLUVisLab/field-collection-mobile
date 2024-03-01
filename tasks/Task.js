class Task {
    constructor(taskID, taskDisplayName, dataLabel, instructions) {
      this.taskID = taskID;
      this.taskDisplayName = taskDisplayName;
      this.dataLabel = dataLabel;
      this.instructions = instructions;
    }
  
    static typeID;
    static typeDisplayName;
    static typeSetupViewPath;
    static typeActionViewPath;
  }
  
  export default Task;