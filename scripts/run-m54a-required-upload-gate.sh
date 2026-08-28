#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

LOG_DIR=".gate-logs"
INDEX_BACKUP=".m54a-index-gate-backup.js"
mkdir -p "$LOG_DIR"
cp index.js "$INDEX_BACKUP"
restore() {
  if [ -f "$INDEX_BACKUP" ]; then
    mv "$INDEX_BACKUP" index.js
  fi
  rm -rf "$LOG_DIR"
}
trap restore EXIT INT TERM

cat > index.js <<'EOF'
import { registerRootComponent } from 'expo';

import M54RequiredUploadGateApp from './gates/M54RequiredUploadGateApp';

registerRootComponent(M54RequiredUploadGateApp);
EOF

scripts/run-android-gate.sh 'M54A_REQUIRED_UPLOAD_RESULT::' "$LOG_DIR/m54a-required-upload.log" 1200
