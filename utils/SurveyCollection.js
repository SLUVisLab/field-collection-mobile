import SurveyItem from './SurveyItem'

class SurveyCollection {
    constructor(name, parent = null) {

    //TODO: Persist collection ID's when converting to and from tsvs
      this.ID = Date.now();
      this.name = name;
      this.subCollections = [];
      this.parent = parent;
      this.items = [];
    }
  }
  
  export default SurveyCollection;