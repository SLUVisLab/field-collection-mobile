require('dotenv').config();
const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/database');
const { compareObservationTimestamps } = require('../utils/time');

// Proxy to MongoDB using native driver
exports.proxyRequest = async (action, payload) => {
  console.log('MongoDB Driver Action:', action);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const collection = await getCollection();
    
    switch (action) {
      case 'find':
        return await handleFind(collection, payload);
      case 'findOne':
        return await handleFindOne(collection, payload);
      case 'aggregate':
        return await handleAggregate(collection, payload);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  } catch (error) {
    console.error('MongoDB Driver Error:', error.message);
    throw error;
  }
};

// Handle find operations
async function handleFind(collection, payload) {
  const { filter = {}, sort, limit, skip, projection } = payload;
  
  // Convert string IDs to ObjectIds in filter
  const processedFilter = convertStringIdsToObjectIds(filter);
  
  let cursor = collection.find(processedFilter);
  
  if (projection) cursor = cursor.project(projection);
  if (sort) cursor = cursor.sort(sort);
  if (skip) cursor = cursor.skip(skip);
  if (limit) cursor = cursor.limit(limit);
  
  const documents = await cursor.toArray();
  return { documents };
}

// Handle findOne operations
async function handleFindOne(collection, payload) {
  const { filter = {}, projection } = payload;
  
  // Convert string IDs to ObjectIds in filter
  const processedFilter = convertStringIdsToObjectIds(filter);
  
  const document = await collection.findOne(processedFilter, { projection });
  return { document };
}

// Handle aggregate operations
async function handleAggregate(collection, payload) {
  const { pipeline } = payload;
  
  if (!pipeline || !Array.isArray(pipeline)) {
    throw new Error('Aggregate requires a pipeline array');
  }
  
  // Process pipeline to convert string IDs to ObjectIds
  const processedPipeline = convertStringIdsInPipeline(pipeline);
  
  const documents = await collection.aggregate(processedPipeline).toArray();
  return { documents };
}

// Helper function to convert string IDs to ObjectIds
function convertStringIdsToObjectIds(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const processed = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id' || key.endsWith('Id')) {
      if (value instanceof ObjectId) {
        processed[key] = value;
      } else if (typeof value === 'string' && ObjectId.isValid(value)) {
        processed[key] = new ObjectId(value);
      } else if (value && typeof value === 'object' && value.$oid && ObjectId.isValid(value.$oid)) {
        processed[key] = new ObjectId(value.$oid);
      } else if (value && typeof value === 'object' && value.$in) {
        processed[key] = {
          ...value,
          $in: value.$in
            .map(id => {
              if (id instanceof ObjectId) return id;
              if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
              if (id && typeof id === 'object' && id.$oid && ObjectId.isValid(id.$oid)) {
                return new ObjectId(id.$oid);
              }
              return null;
            })
            .filter(Boolean)
        };
      } else {
        processed[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      processed[key] = convertStringIdsToObjectIds(value);
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

// Helper function to process aggregation pipelines
function convertStringIdsInPipeline(pipeline) {
  return pipeline.map(stage => {
    if (typeof stage === 'object' && stage !== null) {
      return convertStringIdsToObjectIds(stage);
    }
    return stage;
  });
}

function normalizeIdsToObjectIds(ids = []) {
  return ids
    .map(id => {
      if (id instanceof ObjectId) return id;
      if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
      if (id && typeof id === 'object' && id.$oid && ObjectId.isValid(id.$oid)) {
        return new ObjectId(id.$oid);
      }
      return null;
    })
    .filter(Boolean);
}

// Fetch surveys from MongoDB (updated for driver)
exports.fetchSurveys = async (surveyIds = []) => {
  try {
    const objectIds = normalizeIdsToObjectIds(surveyIds);
    if (!objectIds.length) return [];

    const result = await exports.proxyRequest('find', {
      filter: { _id: { $in: objectIds } }
    });

    return result.documents || [];
  } catch (error) {
    console.error('Error fetching surveys:', error);
    throw error;
  }
};

exports.aggregateSurveysByName = async (surveyIds = []) => {
  const objectIds = normalizeIdsToObjectIds(surveyIds);
  if (!objectIds.length) return [];

  const collection = await getCollection();

  const pipeline = [
    { $match: { _id: { $in: objectIds } } },
    {
      $addFields: {
        observations: {
          $map: {
            input: { $ifNull: ['$observations', []] },
            as: 'obs',
            in: {
              $mergeObjects: [
                '$$obs',
                {
                  surveyId: {
                    $ifNull: [
                      '$$obs.surveyId',
                      { $toString: '$_id' }
                    ]
                  },
                  user: {
                    $ifNull: [
                      '$$obs.user',
                      '$user'
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $ifNull: ['$name', false] },
            '$name',
            '$_id'
          ]
        },
        surveyName: { $first: '$name' },
        surveyIds: { $addToSet: '$_id' },
        surveyComplete: { $max: { $ifNull: ['$surveyComplete', false] } },
        startTime: { $min: '$dateStarted' },
        stopTime: { $max: '$dateCompleted' },
        users: { $addToSet: '$user' },
        tasks: { $first: '$tasks' },
        collections: { $first: '$collections' },
        observations: { $push: '$observations' },
        surveyCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        surveyName: { $ifNull: ['$surveyName', null] },
        surveyIds: 1,
        surveyComplete: 1,
        startTime: 1,
        stopTime: 1,
        users: {
          $filter: {
            input: '$users',
            as: 'user',
            cond: {
              $and: [
                { $ne: ['$$user', null] },
                { $ne: ['$$user', ''] }
              ]
            }
          }
        },
        tasks: { $ifNull: ['$tasks', []] },
        collections: { $ifNull: ['$collections', []] },
        observations: {
          $reduce: {
            input: '$observations',
            initialValue: [],
            in: { $concatArrays: ['$$value', '$$this'] }
          }
        },
        surveyCount: 1
      }
    }
  ];

  const aggregatedResults = await collection.aggregate(pipeline).toArray();

  return aggregatedResults.map(survey => {
    const observationsArray = Array.isArray(survey.observations) ? survey.observations : [];
    const sortedObservations = observationsArray
      .map((observation, index) => ({ observation, index }))
      .filter(entry => Boolean(entry.observation))
      .sort((a, b) => {
        const comparison = compareObservationTimestamps(a.observation, b.observation);
        return comparison === 0 ? a.index - b.index : comparison;
      })
      .map(entry => entry.observation);

    const toISOStringSafe = (value) => {
      if (!value) {
        return null;
      }
      const date = value instanceof Date ? value : new Date(value);
      const time = date.getTime();
      return Number.isNaN(time) ? null : new Date(time).toISOString();
    };

    return {
      surveyName: survey.surveyName || null,
      surveyIds: (survey.surveyIds || []).map(id =>
        id && typeof id.toString === 'function' ? id.toString() : id
      ),
      surveyComplete: Boolean(survey.surveyComplete),
      startTime: toISOStringSafe(survey.startTime),
      stopTime: toISOStringSafe(survey.stopTime),
      users: Array.isArray(survey.users) ? survey.users : [],
      tasks: Array.isArray(survey.tasks) ? survey.tasks : [],
      collections: Array.isArray(survey.collections) ? survey.collections : [],
      observations: sortedObservations,
      observationCount: sortedObservations.length,
      surveyCount: survey.surveyCount || ((survey.surveyIds || []).length)
    };
  });
};