const express = require('express');
const cors = require('cors');
const { connectToMongoDB, closeConnection, getDatabase } = require('./config/database');
const mongodb = require('./controllers/mongodb');
const exportController = require('./controllers/export');
const { createRateLimiter, createApiKeyGuard } = require('./middleware/security');

// Create Express app
const app = express();

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Initialize MongoDB connection on startup
connectToMongoDB().catch(error => {
  console.error('Failed to initialize MongoDB connection:', error);
});

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const db = await getDatabase(); 

    // Simple ping command ensures connectivity
    await db.command({ ping: 1 });

    res.status(200).json({
      ok: true,
      status: 'ok',
      hasUri: Boolean(process.env.MONGODB_URI),
      hasDbName: Boolean(process.env.DATABASE_NAME),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      ok: false,
      status: 'error',
      message: error.message || 'MongoDB connection failed',
    });
  }
});

app.use(createRateLimiter());
app.use(createApiKeyGuard());

// MongoDB proxy routes
app.post('/api/mongodb/:action', mongodb.proxyRequest);

// Export routes
app.post('/api/export/surveys', exportController.startExport);
app.get('/api/export/status/:jobId', exportController.getStatus);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

module.exports = app;