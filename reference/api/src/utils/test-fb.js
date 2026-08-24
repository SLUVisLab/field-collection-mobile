require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { admin } = require('../config/firebase');
const { createExport } = require('../services/storage');

const STATUS_FILE_PREFIX = 'exports';

async function verifyStorageConnection(bucket) {
	console.log('1. Verifying Firebase Storage bucket accessibility...');

	const bucketName = bucket.name || process.env.FIREBASE_STORAGE_BUCKET || '(default bucket)';
	const [exists] = await bucket.exists();

	if (!exists) {
		throw new Error(`Bucket ${bucketName} does not exist or is not accessible with the current credentials.`);
	}

	const [metadata] = await bucket.getMetadata();

	console.log(`✅ Connected to bucket: ${metadata.name}`);
	console.log(`   Location: ${metadata.location}`);
	console.log(`   Storage class: ${metadata.storageClass}`);

	return metadata;
}

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

	const [buffer] = await statusFile.download();
	return JSON.parse(buffer.toString('utf8'));
}

function buildSampleAggregatedSurveys(jobId, surveyIds) {
	const timestamp = Date.now();
	return [
		{
			surveyName: 'Test Survey',
			surveyIds,
			surveyComplete: true,
			startTime: timestamp - 1_000,
			stopTime: timestamp,
			users: ['test-user@example.com'],
			tasks: [],
			collections: [],
			observations: [
				{
					timestamp,
					value: 42,
					notes: 'Sample observation for Firebase test',
					surveyId: jobId,
					surveyName: 'Test Survey',
					user: 'test-user@example.com'
				}
			],
			observationCount: 1,
			surveyCount: 1
		}
	];
}

async function uploadTestArchive(bucket) {
	console.log('\n2. Running export pipeline against Firebase Storage...');

	const jobId = `test-${uuidv4()}`;
	const surveyIds = [jobId];
	const statusFilePath = `${STATUS_FILE_PREFIX}/${jobId}.json`;
	const statusFile = bucket.file(statusFilePath);

	const now = new Date().toISOString();
	const initialStatus = {
		jobId,
		status: 'processing',
		progress: 0,
		surveyCount: surveyIds.length,
		filePath: `exports/${jobId}.zip`,
		statusFilePath,
		createdAt: now,
		updatedAt: now
	};

	await statusFile.save(JSON.stringify(initialStatus, null, 2), {
		contentType: 'application/json'
	});

	const statusManager = createStatusManager(statusFile, initialStatus);
	const sampleAggregatedSurveys = buildSampleAggregatedSurveys(jobId, surveyIds);

	const { filePath, metadata, displayName } = await createExport(jobId, surveyIds, statusManager, {
		aggregateSurveysByName: async () => sampleAggregatedSurveys
	});

	const finalStatus = await readStatusFile(statusFile);
	const file = bucket.file(filePath);
	const [signedUrl] = await file.getSignedUrl({
		action: 'read',
		expires: Date.now() + 15 * 60 * 1000 // 15 minutes
	});

	console.log('✅ Export pipeline finished');
	console.log(`   Status file: ${statusFilePath}`);
	console.log(`   Archive file: ${filePath}`);
	console.log(`   Friendly name: ${finalStatus?.displayName ?? displayName ?? 'n/a'}`);
	console.log(`   Archive size: ${finalStatus?.fileSize ?? 'unknown'} bytes`);
	console.log(`   Observations: ${finalStatus?.observationCount ?? 0}`);
	console.log(`   Temporary download URL (15 min): ${signedUrl}`);

	return { jobId, filePath, statusFilePath, signedUrl, metadata, displayName, status: finalStatus };
}

async function testFirebaseStorage() {
	try {
		const bucket = admin.storage().bucket();
		const bucketName = bucket?.name;

		if (!bucket || !bucketName) {
			throw new Error('Failed to resolve Firebase Storage bucket. Set FIREBASE_STORAGE_BUCKET or ensure the service account project has a default bucket.');
		}

		await verifyStorageConnection(bucket);
		const result = await uploadTestArchive(bucket);

		console.log('\nFinal status snapshot:');
		console.log(JSON.stringify(result.status, null, 2));

		console.log('\n✅ Firebase Storage test completed successfully');
	} catch (error) {
		console.error('\n❌ Firebase Storage test failed:', error.message);
		throw error;
	}
}

if (require.main === module) {
	testFirebaseStorage()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

module.exports = { testFirebaseStorage };
