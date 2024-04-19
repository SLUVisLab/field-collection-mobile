
import { v4 as uuidv4 } from 'uuid';

class SurveyItem {
    constructor(name, id= null) {
      if (id && id.trim() !== '') {
        this.ID = id;
      } else {
        this.ID = uuidv4();
      }
      this.name = name;
    }

  }
  
  export default SurveyItem;