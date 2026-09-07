#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:?platform must be ios or android}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.gate-out"
ENTRY="$ROOT/index.js"
ORIGINAL="$(mktemp)"
cp "$ENTRY" "$ORIGINAL"
restore() {
  cp "$ORIGINAL" "$ENTRY"
  rm -f "$ORIGINAL"
}
trap restore EXIT

printf "import App from './gates/StyleSmokeApp.js';\nimport { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n" > "$ENTRY"

if [ "$PLATFORM" = "android" ]; then
  "$ROOT/scripts/run-android-gate.sh" 'STYLE_SMOKE_RESULT::(light|dark):(light|dark|null)' "$ROOT/.gate-out/style-smoke-android.log" 300
elif [ "$PLATFORM" = "ios" ]; then
  "$ROOT/scripts/run-ios-gate.sh" 'STYLE_SMOKE_RESULT::(light|dark):(light|dark|null)' "$ROOT/.gate-out/style-smoke-ios.log" 300
else
  echo "platform must be ios or android" >&2
  exit 2
fi
