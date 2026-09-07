import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('temporary ONNX Runtime release backport is explicit and upgrade-visible', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)));
  const patch = await readFile(new URL('../../patches/onnxruntime-react-native+1.24.3.patch', import.meta.url), 'utf8');
  const installedGradle = await readFile(
    new URL('../../node_modules/onnxruntime-react-native/android/build.gradle', import.meta.url),
    'utf8'
  );
  assert.equal(packageJson.dependencies['onnxruntime-react-native'], '1.24.3');
  assert.doesNotMatch(installedGradle, /VersionNumber\.parse/);
  assert.match(patch, /OnnxruntimePackage/);
});
