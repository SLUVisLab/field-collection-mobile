require('dotenv').config();
const { testConnection: testDbConnection, closeConnection } = require('../config/database');
const { proxyRequest } = require('../services/mongodb');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    
    // First test the basic connection
    console.log('1. Testing basic MongoDB connection...');
    await testDbConnection();
    
    // Then test a query operation
    console.log('2. Testing query operation...');
    const result = await proxyRequest('find', {
      filter: {},
      limit: 5
    });
    
    console.log('Connection successful!');
    console.log('Number of documents returned:', result.documents?.length || 0);
    
    // Show sample data if available
    if (result.documents && result.documents.length > 0) {
      console.log('Sample document structure:');
      console.log(JSON.stringify(result.documents[0], null, 2));
    }
    
    return result;
  } catch (error) {
    console.error('Connection failed:', error.message);
    throw error;
  } finally {
    // Clean up the connection
    await closeConnection();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testConnection()
    .then(() => {
      console.log('✅ MongoDB test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ MongoDB test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testConnection };