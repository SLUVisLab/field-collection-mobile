const { MongoClient, ServerApiVersion } = require('mongodb');

let client;
let db;
let connecting;

// Initialize MongoDB connection
async function connectToMongoDB() {
  // Return existing connection if it’s healthy
  if (db) return { client, db };

  // If another call is already connecting, wait for it
  if (connecting) {
    await connecting;
    return { client, db };
  }

  connecting = (async () => {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DATABASE_NAME;

    if (!uri) throw new Error('MONGODB_URI is not set');
    if (!dbName) throw new Error('DATABASE_NAME is not set');

    let localClient;
    try {
      console.log('Connecting to MongoDB Atlas...');
      localClient = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      });
      await localClient.connect();
      client = localClient;
      db = client.db(dbName);
      console.log('Successfully connected to MongoDB Atlas');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      try { await localClient?.close(); } catch {}
      client = null;
      db = null;
      throw error;
    } finally {
      connecting = null;
    }
  })();

  await connecting;
  return { client, db };
}

// Get database instance
async function getDatabase() {
  if (!db) {
    await connectToMongoDB();
  }
  return db;
}

// Get collection
async function getCollection(collectionName = process.env.COLLECTION_NAME) {
  const database = await getDatabase();
  if (!collectionName) throw new Error('No collection name provided or COLLECTION_NAME not set');
  return database.collection(collectionName);
}

// Close connection gracefully
async function closeConnection() {
  if (client) {
    console.log('Closing MongoDB connection...');
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

// Test connection
async function testConnection() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    console.log('MongoDB connection test successful');
    return true;
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    throw error;
  }
}

module.exports = {
  connectToMongoDB,
  getDatabase,
  getCollection,
  closeConnection,
  testConnection,
};
