import SurveyItem from './SurveyItem'

class SurveyCollection {
    constructor(name, parent = null, id = null) {

    //TODO: Persist collection ID's when converting to and from xlsx
      this.ID = Math.floor(Math.random() * 1000000000000);
      this.name = name;
      this.subCollections = [];
      this.parent = parent;
      this.items = [];
    }
  }
  
  export default SurveyCollection;