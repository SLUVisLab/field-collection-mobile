import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  createFormsRepository,
  createProjectsRepository,
  ensureProjectDirectories,
  initializeGatherStorage,
  manifestFingerprintFor,
  writeTextAtomic,
} from 'gather-storage';

import App from '../App.js';
import {
  AUTHORED_COMPOSITION_DEFINITION,
  AUTHORED_COMPOSITION_FILENAME,
  AUTHORED_COMPOSITION_ID,
  AUTHORED_COMPOSITION_MANIFEST,
  AUTHORED_FORM_ID,
  AUTHORED_FORM_XML,
} from './fixtures/authoredCompositionFixture.js';

/**
 * Step 5 — **handler-free authored composition → real ODK instance.**
 *
 * The composition is unknown to this build. There is deliberately **no
 * `registerCompositionHandler` call anywhere** for `authored_photo_v1`: its
 * definition arrives only as a version-pinned form resource, and its entire
 * behaviour is ordinary A2UI wiring — a Component output binding plus two
 * `action.functionCall`s.
 *
 * What this proves that nothing else can:
 *
 * ```text
 * unknown-at-build-time composition
 *   → published with a form
 *   → loaded from the form's own resources
 *   → rendered by the generic A2UI host
 *   → executed via registered primitives only
 *   → durable asset  → declared media projection
 *   → real ODK attachment + XForms instance
 * ```
 *
 * Storage is seeded rather than downloaded from Central, so this isolates the
 * *runtime* chain; `recordCachedVersion` is the same call the download path ends
 * in. Proving *delivery* — that Central serves these resources with a content
 * type that survives `isTextResource` — is a separate gate.
 *
 * Navigate to **Forms → Authored photo (dev seed)**, capture, **Save photo**,
 * then **Accept and submit**. Verify in the data, not on screen:
 *
 * ```bash
 * PKG=com.sluvislab.BIIManualPhenotyper
 * adb exec-out "run-as $PKG cat files/SQLite/gather.db" > /tmp/g.db
 * NEW=$(sqlite3 /tmp/g.db "SELECT local_instance_id FROM instances \
 *   WHERE project_key='dev-seed-authored' ORDER BY updated_at DESC LIMIT 1;")
 * sqlite3 /tmp/g.db "SELECT filename FROM instance_media WHERE local_instance_id='$NEW';"
 * sqlite3 /tmp/g.db "SELECT binding_reference FROM instance_receipts WHERE local_instance_id='$NEW';"
 * adb shell "run-as $PKG cat files/gather/projects/dev-seed-authored/instances/$NEW/instance.xml"
 * ```
 *
 * Before Accept: project media and the asset ledger hold the ImageAsset;
 * `instance_media` is empty. After Accept: `instance_media` holds the submission
 * attachment and `<image>` carries **that** filename.
 */
const SEED_PROJECT_KEY = 'dev-seed-authored';

export default function DevSeedAuthoredCompositionApp() {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const seed = async () => {
      try {
        const storage = await initializeGatherStorage();
        const forms = createFormsRepository(storage.database);
        const projects = createProjectsRepository(storage.database);

        await projects.upsertProject({
          projectKey: SEED_PROJECT_KEY,
          displayName: 'Dev seed (authored)',
          baseUrl: 'https://dev-seed.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(SEED_PROJECT_KEY);

        const base = `projects/${SEED_PROJECT_KEY}/forms/${AUTHORED_FORM_ID}`;
        const xmlFileKey = `${base}/form.xml`;
        const manifestKey = `${base}/gather-bindings.json`;
        const definitionKey = `${base}/${AUTHORED_COMPOSITION_FILENAME}`;

        await writeTextAtomic(xmlFileKey, AUTHORED_FORM_XML);
        await writeTextAtomic(manifestKey, JSON.stringify(AUTHORED_COMPOSITION_MANIFEST, null, 2));
        // The composition itself, as ordinary form content.
        await writeTextAtomic(
          definitionKey,
          JSON.stringify(AUTHORED_COMPOSITION_DEFINITION, null, 2)
        );

        const resources = [
          {
            filename: 'gather-bindings.json',
            contentType: 'application/json',
            fileKey: manifestKey,
            hash: 'md5:authoredbindings',
          },
          {
            filename: AUTHORED_COMPOSITION_FILENAME,
            contentType: 'application/json',
            fileKey: definitionKey,
            hash: 'md5:authoredcomposition',
          },
        ];
        await forms.recordCachedVersion({
          projectKey: SEED_PROJECT_KEY,
          formId: AUTHORED_FORM_ID,
          displayName: 'Authored photo (dev seed)',
          sourceVersion: '1',
          sourceHash: 'md5:authoredphoto',
          manifestFingerprint: manifestFingerprintFor(resources),
          xmlFileKey,
          manifestFileKey: `${base}/manifest.json`,
          resources,
        });
        await projects.setActiveProject(SEED_PROJECT_KEY);

        if (!cancelled) {
          console.log(
            `AUTHORED_SEED_READY::${JSON.stringify({
              project: SEED_PROJECT_KEY,
              formId: AUTHORED_FORM_ID,
              composition: AUTHORED_COMPOSITION_ID,
              registeredHandlers: 'none',
            })}`
          );
          setSeeded(true);
        }
      } catch (caught) {
        const message = caught?.message ?? String(caught);
        if (!cancelled) {
          console.log(`AUTHORED_SEED_FAILED::${message}`);
          setError(message);
        }
      }
    };
    void seed();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Authored seed failed</Text>
        <Text style={styles.detail}>{error}</Text>
      </View>
    );
  }
  if (!seeded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.detail}>Seeding an authored composition…</Text>
      </View>
    );
  }
  return <App />;
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', backgroundColor: '#0b0d10', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  error: { color: '#ff6b6b', fontSize: 16, fontWeight: '700' },
  detail: { color: '#9aa4b2', fontSize: 13, textAlign: 'center' },
});
