import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid'
import SurveyItem from './SurveyItem'

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

    addItem(item) {
      if (item.constructor.name === "SurveyItem") {
        this.items.push(item);
      } else {
        console.error("Attempted to add an object that is not an instance of SurveyItem.");
      }
    }

    removeItem(itemId) {
      this.items = this.items.filter(item => item.ID !== itemId);
    }
  
    findItem(itemId) {
      return this.items.find(item => item.ID === itemId);
    }

    addSubcollection(subcollection) {
      if (subcollection instanceof SurveyCollection) {
        this.subCollections.push(subcollection);
      } else {
        console.error("Attempted to add an object that is not an instance of SurveyCollection.");
      }
    }
  
    removeSubcollection(subcollectionId) {
      this.subCollections = this.subCollections.filter(subcollection => subcollection.ID !== subcollectionId);
    }

    findSubcollection(subcollectionId) {
      return this.subCollections.find(subcollection => subcollection.ID === subcollectionId);
    }
  }
  
  export default SurveyCollection;