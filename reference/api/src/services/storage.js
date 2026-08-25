const { admin } = require('../config/firebase');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { aggregateSurveysByName } = require('./mongodb');
const { compareObservationTimestamps } = require('../utils/time');
const { collectMediaEntries } = require('./media');
const { createObservationCsv } = require('../utils/csv');
const logger = require('../utils/logger');
const { v4: uuid } = require('uuid');

function buildDisplayName(aggregatedSurveys = [], extension = 'zip') {
  const defaultBase = 'survey-export';
  const surveyName = aggregatedSurveys.find(survey => survey?.surveyName)?.surveyName || defaultBase;
  const dateStamp = new Date().toISOString().slice(0, 10);

  const sanitizedBase = String(surveyName)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || defaultBase;

  return `${sanitizedBase}-${dateStamp}.${extension}`;
}

function createRemoteStream(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;

    const request = client.get(url, (response) => {
      const statusCode = response.statusCode || 0;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        const redirectedUrl = new URL(response.headers.location, url).toString();
        response.resume();
        resolve(createRemoteStream(redirectedUrl));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Failed to download media (${statusCode}) from ${url}`));
        return;
      }

      resolve(response);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy(new Error(`Request timed out fetching ${url}`));
    });
  });
}

async function appendMediaEntriesToArchive(mediaEntries, archive) {
  let totalBytes = 0;

  for (const entry of mediaEntries) {
    const sourceStream = await createRemoteStream(entry.url);
    const countingStream = new PassThrough();
    let entryBytes = 0;

    countingStream.on('data', chunk => {
      entryBytes += chunk.length;
    });

    const completion = new Promise((resolve, reject) => {
      countingStream.on('end', resolve);
      countingStream.on('error', reject);
      sourceStream.on('error', reject);
    });

    sourceStream.pipe(countingStream);
    archive.append(countingStream, { name: entry.archivePath });

    await completion;
    totalBytes += entryBytes;
  }

  return totalBytes;
}

// Create and store export file
exports.createExport = async (jobId, surveyIds, statusManager, options = {}) => {
  const aggregateFn = options.aggregateSurveysByName || aggregateSurveysByName;
  const requestedFormat = typeof options.format === 'string' ? options.format.toLowerCase() : 'json';
  const includeCsv = requestedFormat === 'csv';
  const includeJson = !includeCsv;
  const dataFormats = includeCsv ? ['csv'] : ['json'];
  const bucket = admin.storage().bucket();
  const filePath = `exports/${jobId}.zip`;
  const file = bucket.file(filePath);
  const token = uuid();

  const fileStream = file.createWriteStream({
    metadata: {
      contentType: 'application/zip',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
      cacheControl: 'private, max-age=0, no-store',

    }
  });

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(fileStream);

  let aggregatedSurveys = [];
  const statusUpdate = async (patch) => {
    if (statusManager && typeof statusManager.update === 'function') {
      await statusManager.update(patch);
    }
  };

  try {
  logger.debug('[Storage] createExport start:', { jobId, surveyIdsCount: surveyIds.length, includeMedia: Boolean(options.includeMedia) });

    await statusUpdate({
      progress: 10,
      dataFormats
    });

    aggregatedSurveys = await aggregateFn(surveyIds);
    const displayName = buildDisplayName(aggregatedSurveys);

    logger.debug('[Storage] Aggregated surveys:', {
      jobId,
      aggregatedCount: aggregatedSurveys.length,
      observationsPerSurvey: aggregatedSurveys.map((survey, index) => ({
        index,
        observationCount: Array.isArray(survey.observations) ? survey.observations.length : 0
      }))
    });

    await statusUpdate({
      progress: 60,
      aggregatedSurveyCount: aggregatedSurveys.length,
      displayName
    });

    const allObservations = aggregatedSurveys
      .flatMap(survey => Array.isArray(survey.observations) ? survey.observations : [])
      .map((observation, index) => ({ observation, index }))
      .filter(entry => Boolean(entry.observation))
      .sort((a, b) => {
        const comparison = compareObservationTimestamps(a.observation, b.observation);
        return comparison === 0 ? a.index - b.index : comparison;
      })
      .map(entry => entry.observation);

    let mediaSummary = { mediaEntries: [], mediaCount: 0, totalBytes: 0 };
    if (options.includeMedia) {
      logger.debug('[Storage] includeMedia enabled, collecting media entries...');
      mediaSummary = collectMediaEntries(allObservations);

      logger.debug('[Storage] Media collection result:', {
        mediaCount: mediaSummary.mediaCount,
        sampleEntries: mediaSummary.mediaEntries.slice(0, 5)
      });

      await statusUpdate({
        includeMedia: true,
        mediaFileCount: mediaSummary.mediaCount
      });
    } else {
      logger.debug('[Storage] includeMedia disabled; skipping media collection.');
    }

    const metadata = {
      exportId: jobId,
      exportDate: new Date().toISOString(),
      requestedSurveyIds: surveyIds,
      aggregatedSurveyCount: aggregatedSurveys.length,
      totalObservationCount: allObservations.length,
      displayName,
      dataFormats,
      surveys: aggregatedSurveys.map(survey => ({
        surveyName: survey.surveyName,
        surveyIds: survey.surveyIds,
        surveyCount: survey.surveyCount,
        startTime: survey.startTime,
        stopTime: survey.stopTime,
        users: survey.users,
        observationCount: survey.observationCount
      })),
      media: {
        included: Boolean(options.includeMedia),
        fileCount: mediaSummary.mediaCount,
        totalBytes: 0
      },
      dataFiles: []
    };

    if (includeJson) {
      archive.append(JSON.stringify(allObservations, null, 2), { name: 'data.json' });
      metadata.dataFiles.push({
        format: 'json',
        name: 'data.json',
        recordCount: allObservations.length
      });
    }

    if (includeCsv) {
      logger.debug('[Storage] Generating CSV export for job:', jobId);
      const { csv, columns } = createObservationCsv(allObservations);
      archive.append(csv, { name: 'data.csv' });
      metadata.dataFiles.push({
        format: 'csv',
        name: 'data.csv',
        recordCount: allObservations.length,
        columnCount: columns.length
      });
    }

    if (options.includeMedia && mediaSummary.mediaCount > 0) {
      logger.debug('[Storage] Appending media files to archive:', mediaSummary.mediaCount);
      const totalBytes = await appendMediaEntriesToArchive(mediaSummary.mediaEntries, archive);
      mediaSummary.totalBytes = totalBytes;
      metadata.media.totalBytes = totalBytes;

      logger.debug('[Storage] Media append complete:', { totalBytes });

      await statusUpdate({
        mediaFileCount: mediaSummary.mediaCount,
        mediaSizeBytes: totalBytes
      });
    } else if (options.includeMedia) {
      logger.debug('[Storage] includeMedia requested but no media detected.');
    }

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    const streamFinished = new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    await archive.finalize();
    await streamFinished;

    logger.debug('[Storage] Archive finalized for job:', jobId, {
      includeMedia: Boolean(options.includeMedia),
      mediaFileCount: metadata.media.fileCount,
      mediaSizeBytes: metadata.media.totalBytes
    });

    await file.setMetadata({
      contentDisposition: `attachment; filename="${displayName}"`,
    });

    const encodedPath = encodeURIComponent(filePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    await statusUpdate({
      status: 'complete',
      progress: 100,
      completedAt: new Date().toISOString(),
      fileSize: archive.pointer(),
      observationCount: metadata.totalObservationCount,
      aggregatedSurveyCount: aggregatedSurveys.length,
      displayName,
      includeMedia: Boolean(options.includeMedia),
      mediaFileCount: metadata.media.fileCount,
      mediaSizeBytes: metadata.media.totalBytes,
      dataFormats,
      downloadUrl,
    });

    return { filePath, metadata, displayName, downloadUrl };
  } catch (error) {
    archive.destroy();
    fileStream.end();

    try {
      await statusUpdate({
        status: 'error',
        error: error.message,
        completedAt: new Date().toISOString()
      });
    } catch (statusError) {
      logger.error(`Failed to update error status for job ${jobId}: ${statusError.message}`);
    }

    throw error;
  }
};