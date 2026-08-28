# Device runtime gates

On-device verification harnesses. They are **not** part of the shipped app entry;
run one by temporarily pointing `index.js` at it, then revert.

## `StorageGateApp.js` — gather-storage runtime gate

Proves the `gather-storage` primitives work on iOS + Android (Hermes) and persist
across a storage re-open:

```
initialize storage → SQLite opens → migration version correct → foreign_keys on
→ write/read structured record → write/read durable text file
→ write/read durable binary file → set/get SecureStore token
→ close + reinitialize (idempotent) → data still exists → delete credential → gone
```

It emits exactly one terminal marker, `STORAGE_GATE_RESULT::{…}` (plus
`STORAGE_GATE_CRASH::` / `STORAGE_GATE_HANG::` fail-safes). Secret values are
never logged — only booleans/lengths.

### Run it

Temporarily edit `index.js`:

```js
import StorageGateApp from './gates/StorageGateApp';
registerRootComponent(StorageGateApp);
```

- iOS: `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`
  then `npm run ios`; watch stdout for `STORAGE_GATE_RESULT::`.
- Android: `scripts/run-android-gate.sh 'STORAGE_GATE_RESULT::' /tmp/storage-android.log 1200`
  (boots/uses an emulator, reads the marker from logcat).

Then revert `index.js` to `import App from './App'`.
