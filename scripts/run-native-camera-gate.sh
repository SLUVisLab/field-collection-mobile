#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:?platform must be ios or android}"
TIMEOUT="${GATE_TIMEOUT:-480}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="$ROOT/index.js"
ORIGINAL="$(mktemp)"
cp "$ENTRY" "$ORIGINAL"
restore() {
  cp "$ORIGINAL" "$ENTRY"
  rm -f "$ORIGINAL"
}
trap restore EXIT

printf "import App from './gates/NativeCameraGateApp.js';\nimport { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n" > "$ENTRY"

if [ "$PLATFORM" = "android" ]; then
  "$ROOT/scripts/run-android-gate.sh" 'NATIVE_CAMERA_RESULT::(PASS|FAIL|UNAVAILABLE)' "$ROOT/.gate-out/native-camera-android.log" "$TIMEOUT"
elif [ "$PLATFORM" = "ios" ]; then
  "$ROOT/scripts/run-ios-gate.sh" 'NATIVE_CAMERA_RESULT::(PASS|FAIL|UNAVAILABLE)' "$ROOT/.gate-out/native-camera-ios.log" "$TIMEOUT"
else
  echo "platform must be ios or android" >&2
  exit 2
fi
