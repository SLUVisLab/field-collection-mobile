import Realm from 'realm';

class SurveyResults extends Realm.Object {

    static schema = {
        name: 'SurveyResults',
        asymmetric: true,
        primaryKey: '_id',
        properties: {
            _id: 'objectId',
            name: 'string',
            dateStarted: 'date',
            dateCompleted: 'date',
            tasks: 'mixed[]',
            collections: 'mixed[]',
            observations: 'mixed[]'
        },
        primaryKey: '_id'
    }
}


export default SurveyResults;