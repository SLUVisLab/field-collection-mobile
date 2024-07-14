
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid';

class SurveyItem {
    constructor(name, id= null, labels= {}, location= {}) {
      if (id && id.trim() !== '') {
        this.ID = id;
      } else {
        this.ID = uuidv4();
      }
      this.name = name;
      this.labels = labels;
      this.location = location;
    }

  }
  
  export default SurveyItem;