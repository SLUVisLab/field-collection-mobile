import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';

class SurveyCollection {
    constructor({ name, parentId = null, parentName = null, id = null }) {

    //TODO: Persist collection ID's when converting to and from xlsx
    
      this.ID = id ? id : uuidv4();
      this.name = name;
      this.subCollections = [];
      this.parentId = parentId ? parentId: null;
      this.parentName = parentName ? parentName : null;
      this.items = [];
    }
  }
  
  export default SurveyCollection;