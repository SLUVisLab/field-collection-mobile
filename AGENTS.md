# AGENTS.md — Gather repo workflow

Working notes and conventions for agents (and humans) building the Gather app.
Keep this file current when a durable pattern or pitfall is discovered.

## What this repo is

Gather is an Expo / React Native field-data-collection app being rebuilt on an
ODK XForms substrate. This branch replaced the legacy Expo 51 app with a fresh
**Expo SDK 57** shell and a set of first-party libraries under `packages/`.

### Layout

```
/                         Expo 57 app shell (index.js, App.js, app.config.js, eas.json)
  packages/               first-party libraries (npm workspaces)
    odk-central-client/   ODK Central REST/OpenRosa client
    odk-xforms-host/       runtime-neutral XForms host interface + types
    odk-xforms-webview/    concrete WebView-sidecar host implementation
    odk-xforms-react/      React bindings (provider/store/hooks)
    gather-storage/        durable local storage (SQLite/FileSystem/SecureStore)
  scripts/                dev + emulator tooling
  gates/                  on-device verification harnesses (not the app entry)
  docs/                   project docs (incl. emulator-gate-runbook.md)
  reference/              ODK Central API / web-client reference (read-only)
  archive/                frozen legacy app + experiments (reference only, not built)
```

The libraries are consumed by the app via **npm workspaces** — import them by
package name (e.g. `import { XFORMS_EVENT_TYPES } from 'odk-xforms-host'`). They
are symlinked into the root `node_modules/`. Metro watches `packages/` (see
`metro.config.js`).

## Toolchain rules

- **Node is not on PATH.** Agent shells are spawned by the editor and do not
  source the login profile. Prefix commands with `export PATH="/usr/local/bin:$PATH"`
  (node lives at `/usr/local/bin/node`, currently v20.4.0). Expo 57 prints an
  "unsupported Node" warning at <20.19.4 — it is a soft warning; bundling works.
- **Pin to Expo SDK 57.** Expo has changed a lot; read the versioned docs at
  https://docs.expo.dev/versions/v57.0.0/ before writing app/native code. Do not
  copy patterns from older SDK docs.
- **No `babel.config.js` is needed.** Expo 57 applies `babel-preset-expo`
  automatically. Adding an explicit babel config that references
  `babel-preset-expo` breaks Metro (module not resolvable from root). Leave it out.
- **Native folders are generated.** `ios/` and `android/` are gitignored and
  produced by `expo prebuild` / `expo run:*`. Do not commit them.

## UI and Styling Conventions

- `src/theme/` is the source of truth for shared colors, spacing, radii,
  typography, and interaction dimensions. Use semantic theme colors, follow the
  device light/dark scheme, and do not add a styling dependency without
  architectural review.
- Local Component `StyleSheet`s own local layout; shared visual decisions belong
  in tokens. Promote repeated visual and interactive patterns to Components,
  not copied style objects.
- Field controls are at least 48 dp, preferably about 52 dp; primary actions
  are about 56 dp. Do not rely only on invisible hit slop, and leave clear
  space between actions.
- Preserve system font scaling and avoid fixed text containers. Target WCAG AA
  contrast, do not convey state by color alone, and provide correct
  accessibility roles and state for interactive Components.
- `src/components/` holds reusable React Components; future A2UI exposure needs
  an explicit registry. Declarative consumers must reuse themed Components and
  semantic variants rather than arbitrary appearance.

## Common commands

```bash
export PATH="/usr/local/bin:$PATH"

npm install                 # install app + link workspace packages
npm run test:packages       # run all package unit tests (excludes live tests)
npx expo config --type public   # validate app.config.js
npx expo export --platform android --output-dir /tmp/x   # Metro bundle smoke (no device)
```

### Running a package's tests directly

Node 20 does not expand the `test/**/*.test.mjs` glob for `node --test`. Run:

```bash
cd packages/<name> && node --test $(find test -name '*.test.mjs' -not -path '*/live/*')
```

## Device gates (iOS Simulator / Android emulator)

The definitive procedure — including why runs look like they hang and how to
detect real completion — is in [docs/emulator-gate-runbook.md](docs/emulator-gate-runbook.md).

- Make the Android SDK/emulator tooling available: `source scripts/android-ios-env.sh`.
- Android runs must be detected via **logcat** (`ReactNativeJS` tag), not expo
  stdout. Use `scripts/run-android-gate.sh '<TERMINAL_MARKER>' <logfile> <timeout>`.
- Harnesses should print exactly one unambiguous terminal marker when done
  (e.g. `M45_RUNTIME_RESULT::{...}`) plus crash/hang fail-safe markers.
- **Run platforms sequentially.** Shut down the specific iOS Simulator or Android
  emulator immediately after its gate passes/fails and before booting the other
  platform. Keeping both open substantially degrades native build and device-gate
  reliability on this machine.

### Build gotchas (verified on-device 2026-08)

The app builds and runs on iPhone simulator and Android emulator, with all
package smoke checks green on both. Two environment traps to know:

- **iOS `pod install` needs a UTF-8 locale.** CocoaPods lives at
  `/opt/homebrew/bin` (add it to PATH). Without `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`
  it dies with `Unicode Normalization not appropriate for ASCII-8BIT`, leaving
  Pods out of sync and the Xcode build failing with error 65. Run iOS builds as:
  `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- **TypeScript setup is disabled** (`EXPO_NO_TYPESCRIPT_SETUP=1`, baked into the
  npm scripts). `archive/` vendors ~1k third-party `.ts` files; Expo's dev-server
  TS-setup check scans the whole project, finds them, and refuses to start Metro.
  `archive/` is also excluded from the Metro graph via `resolver.blockList` in
  `metro.config.js`. If you ever adopt TypeScript in the app, re-enable it
  deliberately rather than by removing the env flag.
- **iOS Simulator has no VisionCamera rear camera.** Camera and QR views must
  preflight for an available camera device and present their fallback rather than
  mounting the native view. Validate real photo capture and QR decoding on a
  physical iOS device when one is connected; simulator runs only validate the
  safe unavailable state.
- Native folders `ios/` and `android/` are generated by `expo prebuild` /
  `expo run:*` and are gitignored — do not commit them.

## Live ODK Central + secrets

- Live/integration tests are **env-gated** and skip when the env is absent, so
  the default `npm run test:packages` stays offline and green.
- Never commit credentials. Local secrets live in gitignored files:
  `.env`, `*.local.js` (e.g. `liveConfig.local.js`). `.env.example` documents the
  expected variables (Firebase, Google Services/Maps, and ODK Central).
- `app.config.js` injects `googleServicesFile` / Google Maps keys from env; they
  are no-ops when unset.

## Deployment config

`app.config.js` + `eas.json` preserve the project's deployment identity (EAS
`projectId`, Updates URL, bundle identifiers, runtimeVersion, permissions).
Config plugins for native modules not yet in the shell (Firebase, camera, av,
location, maps, permissions) are intentionally omitted; re-add each with its
dependency as the capability lands. The full original config is preserved in
`archive/legacy-app/config-reference/`.

## Git conventions

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Never force-push, amend, or skip hooks without explicit approval.
