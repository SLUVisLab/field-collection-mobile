#!/usr/bin/env bash
#
# Run one M6.6 Central-backed device gate. Run Android first and iOS second by
# invoking this script separately with M66_PLATFORM set for each target.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

if [ ! -f central-live.env ]; then
  echo "M66 gate blocked: central-live.env is not available"
  exit 2
fi

set -a
. ./central-live.env
set +a
if [ -z "${ODK_CENTRAL_URL:-}" ] ||
  [ -z "${ODK_CENTRAL_PROJECT_ID:-}" ] ||
  [ -z "${ODK_CENTRAL_APP_USER_TOKEN:-}" ] ||
  [ -z "${ODK_CENTRAL_EMAIL:-}" ] ||
  [ -z "${ODK_CENTRAL_PASSWORD:-}" ]; then
  echo "M66 gate blocked: required Central environment variable is missing"
  exit 2
fi

if [ "${M66_PLATFORM:-}" != "android" ] && [ "${M66_PLATFORM:-}" != "ios" ]; then
  echo "M66 gate blocked: M66_PLATFORM must be android or ios"
  exit 2
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export EXPO_PUBLIC_M66_CENTRAL_URL="$ODK_CENTRAL_URL"
export EXPO_PUBLIC_M66_CENTRAL_PROJECT_ID="$ODK_CENTRAL_PROJECT_ID"
export EXPO_PUBLIC_M66_CENTRAL_APP_USER_TOKEN="$ODK_CENTRAL_APP_USER_TOKEN"
export EXPO_PUBLIC_M66_REGISTRATION_FORM_ID="${M66_REGISTRATION_FORM_ID:-${ODK_CENTRAL_REGISTRATION_FORM_ID:-silphium_plant_registration}}"
export EXPO_PUBLIC_M66_OBSERVATION_FORM_ID="${M66_OBSERVATION_FORM_ID:-${ODK_CENTRAL_ENTITY_FORM_ID:-silphium_flower_survey_entities}}"
export EXPO_PUBLIC_M66_DATASET="${M66_DATASET:-${ODK_CENTRAL_DATASET:-plants}}"

LOG_DIR=".gate-logs"
INDEX_BACKUP=".m66-index-gate-backup.js"
GATE_LOG="$LOG_DIR/m66-${M66_PLATFORM}.log"
mkdir -p "$LOG_DIR"
cp index.js "$INDEX_BACKUP"
restore() {
  if [ -f "$INDEX_BACKUP" ]; then
    mv "$INDEX_BACKUP" index.js
  fi
  rm -rf "$LOG_DIR"
}
trap restore EXIT INT TERM

# Verify that the explicit current form IDs resolve through the configured App
# User before changing the app entry point. Output deliberately contains no URL
# or credentials.
if ! node scripts/verify-m66-central-readback.mjs --preflight; then
  echo "M66_${M66_PLATFORM}_GATE::FAIL"
  exit 1
fi

cat > index.js <<'EOF'
import { registerRootComponent } from 'expo';

import M66FullOfflineRuntimeGateApp from './gates/M66FullOfflineRuntimeGateApp';

registerRootComponent(M66FullOfflineRuntimeGateApp);
EOF

if [ "$M66_PLATFORM" = "ios" ]; then
  runner="scripts/run-ios-gate.sh"
else
  runner="scripts/run-android-gate.sh"
fi

if "$runner" 'M66_FULL_OFFLINE_RUNTIME_RESULT::' "$GATE_LOG" 1200 &&
  node scripts/verify-m66-central-readback.mjs "$GATE_LOG"; then
  echo "M66_${M66_PLATFORM}_GATE::PASS"
  exit 0
fi

echo "M66_${M66_PLATFORM}_GATE::FAIL"
exit 1
