import Realm from 'realm';

class SurveyDesign extends Realm.Object {

    static schema = {
        name: 'SurveyDesign',
        primaryKey: '_id',
        properties: {
            _id: 'objectId',
            name: 'string',
            tasks: 'mixed[]',
            collections: 'mixed[]',
        },
        primaryKey: '_id'
    }
}


export default SurveyDesign;