const { v4: uuidv4 } = require('uuid');
const { admin } = require('../config/firebase');
const { createExport } = require('../services/storage');
const logger = require('../utils/logger');

const STATUS_FILE_PREFIX = 'exports';

function createStatusManager(statusFile, initialStatus = {}) {
  let status = { ...initialStatus };

  const serialize = () => JSON.stringify(status, null, 2);

  return {
    getStatus: () => status,
    async update(patch = {}) {
      status = {
        ...status,
        ...patch,
        updatedAt: new Date().toISOString()
      };

      await statusFile.save(serialize(), {
        contentType: 'application/json'
      });

      return status;
    }
  };
}

async function readStatusFile(statusFile) {
  const [exists] = await statusFile.exists();
  if (!exists) {
    return null;
  }

  const [content] = await statusFile.download();
  try {
    return JSON.parse(content.toString('utf8'));
  } catch (error) {
    console.error(`Failed to parse status file ${statusFile.name}: ${error.message}`);
    throw new Error('Job status file is corrupted');
  }
}

exports.startExport = async (req, res) => {
  try {
  const { surveyIds, includeMedia = false, format = 'json' } = req.body;

  const normalizedFormat = typeof format === 'string' ? format.trim().toLowerCase() : 'json';
  const supportedFormats = new Set(['json', 'csv']);

  logger.debug('[Export] Incoming includeMedia flag:', includeMedia, 'type:', typeof includeMedia, 'format:', normalizedFormat);
    
    // Validate request
    if (!surveyIds || !Array.isArray(surveyIds) || surveyIds.length === 0) {
      return res.status(400).json({ error: 'Valid surveyIds array is required' });
    }

    if (typeof includeMedia !== 'boolean') {
      return res.status(400).json({ error: 'includeMedia must be a boolean when provided' });
    }

    if (!supportedFormats.has(normalizedFormat)) {
      return res.status(400).json({ error: 'format must be one of: json, csv' });
    }
    
    // Create job ID
    const jobId = uuidv4();

    const bucket = admin.storage().bucket();
    const statusFilePath = `${STATUS_FILE_PREFIX}/${jobId}.json`;
    const statusFile = bucket.file(statusFilePath);

    const now = new Date().toISOString();
    const initialStatus = {
      jobId,
      status: 'processing',
      progress: 0,
      surveyCount: surveyIds.length,
      filePath: `${STATUS_FILE_PREFIX}/${jobId}.zip`,
      statusFilePath,
      displayName: null,
      requestedFormat: normalizedFormat,
      dataFormats: normalizedFormat === 'csv' ? ['csv'] : ['json'],
      createdAt: now,
      updatedAt: now
    };

    await statusFile.save(JSON.stringify(initialStatus, null, 2), {
      contentType: 'application/json'
    });

  const statusManager = createStatusManager(statusFile, initialStatus);

  logger.debug('[Export] Queuing export job', jobId, 'with includeMedia:', includeMedia);
    
    const statusPath = `/export/status/${jobId}`;
    const statusEndpoint = `/api${statusPath}`;
    const statusUrl = `${req.protocol || 'https'}://${req.get('host')}${statusEndpoint}`;

    // Respond immediately
    res.json({
      jobId,
      status: 'processing',
      statusCheckPath: statusPath,
      statusCheckUrl: statusUrl,
      statusCheckEndpoint: statusEndpoint
    });
    
    // Process in background
  createExport(jobId, surveyIds, statusManager, { includeMedia, format: normalizedFormat })
      .then(() => {
        logger.debug('[Export] createExport resolved for job', jobId, 'includeMedia:', includeMedia);
      })
      .catch(async error => {
        logger.error(`Export error (job ${jobId}): ${error.message}`);
        try {
          await statusManager.update({
            status: 'error',
            error: error.message,
            progress: 100
          });
        } catch (statusError) {
          logger.error(`Failed to persist error status for job ${jobId}: ${statusError.message}`);
        }
      });
      
  } catch (error) {
    logger.error(`Export setup error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const bucket = admin.storage().bucket();
    const statusFile = bucket.file(`${STATUS_FILE_PREFIX}/${jobId}.json`);
    const jobData = await readStatusFile(statusFile);
    
    if (!jobData) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // If complete, prefer the downloadUrl written by createExport
    if (jobData.status === 'complete' && !jobData.downloadUrl) {
      // Fallback: rebuild from object metadata if needed
      const filePath = jobData.filePath || `${STATUS_FILE_PREFIX}/${jobId}.zip`;
      const file = bucket.file(filePath);
      const [md] = await file.getMetadata();
      const token = md?.metadata?.firebaseStorageDownloadTokens;
      if (token) {
        const encoded = encodeURIComponent(filePath);
        jobData.downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
      }
    }
    
    return res.json(jobData);
  } catch (error) {
    logger.error(`Status check error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};