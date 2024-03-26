import Realm from 'realm';

class Response extends Realm.Object {
    static schema = {
        name: 'Response',
        properties: {
            _id: 'int',
            item_name: 'string',
            item_id: 'int',
            date_recorded: 'date',
            collection: 'string',
            meta_collection: 'string?',
            data: { type: 'Dictionary', objectType: 'Mixed' },
            survey: {
                type: 'linkingObjects',
                objectType: 'Survey',
                property: 'responses',
              }
        },
        primaryKey: '_id'
    }
}


export default Response;