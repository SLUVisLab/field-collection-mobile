import Realm from 'realm';

class Survey extends Realm.Object {
    static schema = {
        name: 'Survey',
        properties: {
            _id: 'int',
            name: 'string',
            date_started: 'date',
            date_completed: 'date',
            responses: 'Response[]'
        },
        primaryKey: '_id'
    }
}


export default Survey;