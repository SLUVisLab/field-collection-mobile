#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

PLATFORM="${M80_PLATFORM:-android}"
if [ "$PLATFORM" != "android" ] && [ "$PLATFORM" != "ios" ]; then
  echo "M80 gate requires M80_PLATFORM=android or ios"
  exit 2
fi

INDEX_BACKUP=".m80-index-gate-backup.js"
LOG_FILE=".gate-logs/m80-${PLATFORM}.log"
mkdir -p .gate-logs
cp index.js "$INDEX_BACKUP"
restore() {
  if [ -f "$INDEX_BACKUP" ]; then
    mv "$INDEX_BACKUP" index.js
  fi
  rm -f "$LOG_FILE"
}
trap restore EXIT INT TERM

cat > index.js <<'EOF'
import { registerRootComponent } from 'expo';

import M80NativeSubstrateGateApp from './gates/M80NativeSubstrateGateApp';

registerRootComponent(M80NativeSubstrateGateApp);
EOF

if [ "$PLATFORM" = "ios" ]; then
  IOS_GATE_BUNDLE_ID="org.imagingforgood.gather" \
    IOS_GATE_MARKER_FILE="m80-native-substrate-result.txt" \
    scripts/run-ios-gate.sh 'M80_NATIVE_SUBSTRATE_RESULT::' "$LOG_FILE" 1200
else
  scripts/run-android-gate.sh 'M80_NATIVE_SUBSTRATE_RESULT::' "$LOG_FILE" 1200
fi
