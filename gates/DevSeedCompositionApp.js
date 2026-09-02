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
import { registerComposition } from '../src/a2ui/compositionRegistry.js';
import {
  QUADRAT_TALLY_DEFINITION,
  QUADRAT_TALLY_MANIFEST,
} from '../test/fixtures/quadrat-tally/definition.mjs';
import { createQuadratTallyActionHandler } from '../test/fixtures/quadrat-tally/actionHandler.mjs';

/**
 * Dev seed — an authored composition field in the **real app**.
 *
 * Registers Quadrat Tally, seeds a form whose group carries
 * `gather-composition:<id>` plus a `gather-bindings.json` attachment, then
 * mounts `App` unmodified. Everything after boot is the shipped shell, the
 * shipped `FormRunner`, its composition adapter, and the shipped commit path.
 *
 * Going *through* `FormRunner` rather than mounting the control directly is the
 * point: testing around the screen is what let three earlier defects survive
 * (docs/components-capabilities-ownership.md §25), and the composition registry
 * is a registry rather than a frozen constant precisely so this is possible.
 *
 * Navigate to Forms → Quadrat tally (dev seed), tally a few, optionally flag it
 * uncertain, and Accept. The backing fields are hidden because the composition
 * owns its subtree, so what proves the commit is the values appearing in the
 * saved draft — reopen it from Drafts to see them.
 */
const SEED_PROJECT_KEY = 'dev-seed-composition';
const SEED_FORM_ID = 'dev_seed_quadrat_tally';
const GROUP = '/data/quadrat';

// The pyxform-canonical shape: the composition token on a plain group, with
// ordinary writable backing fields so another ODK client can fill them by hand
// (docs/b-custom-composition-conventions.md §1 and §2).
const FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Quadrat tally (dev seed)</h:title><model>
    <instance><data id="${SEED_FORM_ID}">
      <site_name/>
      <quadrat>
        <count/>
        <note/>
      </quadrat>
      <meta><instanceID/></meta>
    </data></instance>
    <bind nodeset="/data/site_name" type="string"/>
    <bind nodeset="/data/quadrat/count" type="int"/>
    <bind nodeset="/data/quadrat/note" type="string"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/site_name"><label>Site name</label></input>
    <group ref="${GROUP}" appearance="gather-composition:${QUADRAT_TALLY_DEFINITION.id}">
      <label>Quadrat</label>
      <input ref="/data/quadrat/count"><label>Count</label></input>
      <input ref="/data/quadrat/note"><label>Note</label></input>
    </group>
  </h:body>
</h:html>`;

// Behaviour is code, so the harness supplies it; only the definition and the
// manifest could travel with the form. See compositionRegistry.js.
registerComposition(QUADRAT_TALLY_DEFINITION.id, {
  definition: QUADRAT_TALLY_DEFINITION,
  createActionHandler: createQuadratTallyActionHandler({}),
});

export default function DevSeedCompositionApp() {
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
          displayName: 'Dev seed (composition)',
          baseUrl: 'https://dev-seed.invalid',
          centralProjectId: 1,
        });
        ensureProjectDirectories(SEED_PROJECT_KEY);

        const base = `projects/${SEED_PROJECT_KEY}/forms/${SEED_FORM_ID}`;
        const xmlFileKey = `${base}/form.xml`;
        // The manifest rides the ordinary form-resource path, which is what
        // makes it an attachment `loadVersion` hands back as text. Declared
        // application/json so `isTextResource` classifies it as text — if it
        // came back base64 the manifest would silently never be found.
        const manifestResourceKey = `${base}/gather-bindings.json`;
        await writeTextAtomic(xmlFileKey, FORM_XML);
        await writeTextAtomic(manifestResourceKey, JSON.stringify(QUADRAT_TALLY_MANIFEST, null, 2));

        const resources = [
          {
            filename: 'gather-bindings.json',
            contentType: 'application/json',
            fileKey: manifestResourceKey,
            hash: 'md5:devseedbindings',
          },
        ];
        await forms.recordCachedVersion({
          projectKey: SEED_PROJECT_KEY,
          formId: SEED_FORM_ID,
          displayName: 'Quadrat tally (dev seed)',
          sourceVersion: '1',
          sourceHash: 'md5:devseedquadrat',
          manifestFingerprint: manifestFingerprintFor(resources),
          xmlFileKey,
          manifestFileKey: `${base}/manifest.json`,
          resources,
        });
        await projects.setActiveProject(SEED_PROJECT_KEY);

        if (!cancelled) {
          console.log(
            `COMPOSITION_SEED_READY::${JSON.stringify({
              project: SEED_PROJECT_KEY,
              formId: SEED_FORM_ID,
              composition: QUADRAT_TALLY_DEFINITION.id,
            })}`
          );
          setSeeded(true);
        }
      } catch (caught) {
        const message = caught?.message ?? String(caught);
        if (!cancelled) {
          console.log(`COMPOSITION_SEED_FAILED::${message}`);
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
        <Text style={styles.error}>Composition seed failed</Text>
        <Text style={styles.detail}>{error}</Text>
      </View>
    );
  }
  if (!seeded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.detail}>Seeding a composition form…</Text>
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
