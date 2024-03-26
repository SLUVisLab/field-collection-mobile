

class SurveyItem {
    constructor(name, id= null) {
      if (id && id.trim() !== '') {
        this.ID = id;
      } else {
        this.ID = Date.now();
      }
      this.name = name;
    }

  }
  
  export default SurveyItem;