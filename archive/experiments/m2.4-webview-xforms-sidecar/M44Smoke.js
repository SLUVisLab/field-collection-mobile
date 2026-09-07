import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';

import { OdkCentralClient, createAppUserAuth } from './src/central/index.js';
import { LIVE_CONFIG } from './src/central/liveConfig.local.js';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const instanceXml = (id, version, photoName) => `<?xml version="1.0"?>
<data id="${LIVE_CONFIG.formId}" version="${version}">
  <field_site>M4.4 device smoke</field_site>
  <block>1</block><column>1</column><row>1</row>
  <flower_head_count>1</flower_head_count>
  <plant_height_cm>5.0</plant_height_cm>
  ${photoName ? `<flower_photos><photo_type>whole_plant</photo_type><flower_photo>${photoName}</flower_photo></flower_photos>` : ''}
  <meta><instanceID>${id}</instanceID><instanceName>m4.4-${Platform.OS}</instanceName></meta>
</data>`;

export default function M44Smoke() {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  const log = (msg) => {
    console.log(msg);
    setLines((prev) => [...prev, msg]);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const client = new OdkCentralClient({
        baseUrl: LIVE_CONFIG.baseUrl,
        projectId: LIVE_CONFIG.projectId,
        auth: createAppUserAuth(LIVE_CONFIG.appUserToken),
        timeoutMs: 45000,
      });
      log(`M44_ENV::platform=${Platform.OS}::hermes=${typeof HermesInternal !== 'undefined'}`);

      const forms = await client.listForms();
      const form = forms.find((f) => f.formId === LIVE_CONFIG.formId);
      if (!form) throw new Error(`form ${LIVE_CONFIG.formId} not visible`);
      const version = form.version;
      log(`M44_FORM::version=${version}`);

      // Submit through the CLIENT with a given attachment body; return instanceId.
      const clientSubmit = async (label, photoName, makeData) => {
        const id = `uuid:m4-4-${label}-${uid()}`;
        log(`M44_STEP_START::${label}`);
        try {
          const attachments = photoName
            ? [{ name: photoName, contentType: 'image/png', data: await makeData() }]
            : [];
          const r = await client.submit({ xml: instanceXml(id, version, photoName), attachments });
          log(`M44_STEP_OK::${label}::status=${r.status}::instanceId=${id}`);
          return { label, ok: r.status === 201, status: r.status, instanceId: id, filename: photoName };
        } catch (e) {
          log(`M44_STEP_FAIL::${label}::${e && e.code ? e.code : ''}::${e && e.message}`);
          return { label, ok: false, error: e && e.message, filename: photoName };
        }
      };

      // text-only baseline
      const textOnly = await clientSubmit('textonly', null, null);

      // Client + Blob attachment (standards path)
      const blobName = 'm44-client-blob.png';
      const blobUri = FileSystem.cacheDirectory + blobName;
      await FileSystem.writeAsStringAsync(blobUri, TINY_PNG_B64, { encoding: 'base64' });
      const clientBlob = await clientSubmit('clientBlob', blobName, async () => (await fetch(blobUri)).blob());

      // Client + Expo File attachment (preferred file-backed path)
      const efName = 'm44-client-expofile.png';
      const efUri = FileSystem.cacheDirectory + efName;
      await FileSystem.writeAsStringAsync(efUri, TINY_PNG_B64, { encoding: 'base64' });
      const clientExpoFile = await clientSubmit('clientExpoFile', efName, async () => new ExpoFile(efUri));

      const summary = {
        platform: Platform.OS,
        hermes: typeof HermesInternal !== 'undefined',
        formVersion: version,
        textOnly,
        clientBlob,
        clientExpoFile,
      };
      log(`M44_RESULT::${JSON.stringify(summary)}`);
      setDone(true);
    };

    run().catch((error) => {
      log(`M44_CRASH::${error && error.message ? error.message : String(error)}`);
      setDone(true);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M4.4 Central client smoke {done ? '(done)' : '(running…)'}</Text>
      <ScrollView style={styles.log}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.line}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 12, backgroundColor: '#0b1021' },
  title: { color: '#e8ecff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  log: { flex: 1 },
  line: { color: '#9ad', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 2 },
});
