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

/**
 * Dev seed — puts a `gather-multi-image` form in front of the **real app**.
 *
 * This closes the one loop nothing else reaches. §20's headless gate proves the
 * pipeline and §21's interactive gate proves the control, but both supply their
 * *own* collection adapter — which is exactly how §22's defect survived, where
 * `FormRunner` read `instance.media` (always `undefined`) and would have
 * rendered an empty collection for every form in the shipped app.
 *
 * So: seed a project, an active selection, and one cached form version, then
 * mount `App` **unmodified**. Everything after boot is the real shell, the real
 * `FormRunner`, and the real collection adapter. Navigate to Forms -> Photo
 * collection (dev seed) and capture.
 *
 * Deliberately not a Central round trip: `recordCachedVersion` is the same call
 * the download path ends in, so this exercises the identical cached-form state
 * without a server. Confirming Central's *download* remains that round trip's
 * job (still deferred).
 *
 * Seeding is idempotent — it re-seeds on every launch so a rerun is never
 * confused by the last one. Drafts from prior runs survive in the Drafts list.
 */
const SEED_PROJECT_KEY = 'dev-seed-collection';
const SEED_FORM_ID = 'dev_seed_photo_collection';

// The pyxform-canonical shape: appearance on <repeat>, wrapping <group> bare,
// and an image child the author named something other than `photo`.
// See docs/b-standard-field-conventions.md §1.
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Photo collection (dev seed)</h:title><model>
    <instance><data id="${SEED_FORM_ID}">
      <site_name/>
      <photos jr:template=""><frame/></photos>
      <meta><instanceID/></meta>
    </data></instance>
    <bind nodeset="/data/site_name" type="string"/>
    <bind nodeset="/data/photos/frame" type="binary"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/site_name"><label>Site name</label></input>
    <group ref="/data/photos">
      <label>Photos</label>
      <repeat nodeset="/data/photos" appearance="gather-multi-image min=2 max=4">
        <upload ref="/data/photos/frame" mediatype="image/*"><label>Photo</label></upload>
      </repeat>
    </group>
  </h:body>
</h:html>`;

export default function DevSeedCollectionFormApp() {
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
          displayName: 'Dev seed',
          baseUrl: 'https://dev-seed.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(SEED_PROJECT_KEY);

        const xmlFileKey = `projects/${SEED_PROJECT_KEY}/forms/${SEED_FORM_ID}/form.xml`;
        await writeTextAtomic(xmlFileKey, FORM_XML);
        // The same call the Central download path ends in, so the cached state
        // is identical; it also sets this version current, which is what
        // formCatalogService.loadCurrentForm requires.
        await forms.recordCachedVersion({
          projectKey: SEED_PROJECT_KEY,
          formId: SEED_FORM_ID,
          displayName: 'Photo collection (dev seed)',
          sourceVersion: '1',
          sourceHash: 'md5:devseedcollection',
          manifestFingerprint: manifestFingerprintFor([]),
          xmlFileKey,
          manifestFileKey: `projects/${SEED_PROJECT_KEY}/forms/${SEED_FORM_ID}/manifest.json`,
          resources: [],
        });
        // Selected last: the app boots straight into this project's shell.
        await projects.setActiveProject(SEED_PROJECT_KEY);

        if (!cancelled) {
          console.log(`DEV_SEED_READY::${JSON.stringify({ project: SEED_PROJECT_KEY, formId: SEED_FORM_ID })}`);
          setSeeded(true);
        }
      } catch (caught) {
        if (!cancelled) {
          const message = caught?.message ?? String(caught);
          console.log(`DEV_SEED_FAILED::${message}`);
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
        <Text style={styles.error}>Dev seed failed</Text>
        <Text style={styles.detail}>{error}</Text>
      </View>
    );
  }
  if (!seeded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.detail}>Seeding a gather-multi-image form…</Text>
      </View>
    );
  }
  // From here on it is the shipped app, unmodified.
  return <App />;
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', backgroundColor: '#0b0d10', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  error: { color: '#ff6b6b', fontSize: 16, fontWeight: '700' },
  detail: { color: '#9aa4b2', fontSize: 13, textAlign: 'center' },
});
