import Task from  "../tasks/Task.js";

class Survey {
    constructor(name) {
        // TODO: Add checks for duplicate names?
        this.name = name;
        this.tasks = [];
        this.lastSubmitted = null;
        this.created = null;
        this.collections = [];
    }

    static openFromTSV(name) {
        // open survey from tsv file
    }

    static saveToTSV(Survey) {
        // save survey to tsv file
    }

    addTask(task) {
        if(task instanceof Task) {
            this.tasks.push(task);
            console.log("task added successfully")
        } else {
            console.error("Error: Invalid Task. Only Task objects can be added")
        }
    }
  
    }

    export default Survey;