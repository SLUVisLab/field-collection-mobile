import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';

class SurveyCollection {
    constructor(name, parent = null, id = null) {

    //TODO: Persist collection ID's when converting to and from xlsx
      this.ID = uuidv4();
      this.name = name;
      this.subCollections = [];
      this.parent = parent;
      this.items = [];
    }
  }
  
  export default SurveyCollection;