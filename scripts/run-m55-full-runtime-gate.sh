#!/usr/bin/env bash
#
# Runs the final M5 gate on both Hermes targets. The supplied local Central
# configuration is exported only into the launched development bundle; it is
# never echoed and all transient gate logs/index edits are removed on exit.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

if [ ! -f central-live.env ]; then
  echo "M55 gate blocked: central-live.env is not available"
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
  echo "M55 gate blocked: required Central environment variable is missing"
  exit 2
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export EXPO_PUBLIC_M55_CENTRAL_URL="$ODK_CENTRAL_URL"
export EXPO_PUBLIC_M55_CENTRAL_PROJECT_ID="$ODK_CENTRAL_PROJECT_ID"
export EXPO_PUBLIC_M55_CENTRAL_APP_USER_TOKEN="$ODK_CENTRAL_APP_USER_TOKEN"

LOG_DIR=".gate-logs"
INDEX_BACKUP=".m55-index-gate-backup.js"
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

import M55FullRuntimeGateApp from './gates/M55FullRuntimeGateApp';

registerRootComponent(M55FullRuntimeGateApp);
EOF

run_target() {
  local target="$1"
  local gate_log="$LOG_DIR/m55-${target}.log"
  local runner
  if [ "$target" = "ios" ]; then
    runner="scripts/run-ios-gate.sh"
  else
    runner="scripts/run-android-gate.sh"
  fi

  if "$runner" 'M55_FULL_RUNTIME_RESULT::' "$gate_log" 1200; then
    if node scripts/verify-m55-central-readback.mjs "$gate_log"; then
      echo "M55_${target}_GATE::PASS"
      return 0
    fi
  fi
  echo "M55_${target}_GATE::FAIL"
  return 1
}

shutdown_target() {
  local target="$1"
  if [ "$target" = "ios" ]; then
    xcrun simctl shutdown booted 2>/dev/null || true
    return
  fi

  local serial
  serial="$("$HOME/Library/Android/sdk/platform-tools/adb" devices | awk '/^emulator-.*[[:space:]]device$/ { print $1; exit }')"
  if [ -n "$serial" ]; then
    "$HOME/Library/Android/sdk/platform-tools/adb" -s "$serial" shell reboot -p 2>/dev/null || true
  fi
}

status=0
if [ -n "${M55_PLATFORM:-}" ]; then
  targets=("$M55_PLATFORM")
else
  targets=(ios android)
fi
for target in "${targets[@]}"; do
  if [ "$target" != "ios" ] && [ "$target" != "android" ]; then
    echo "M55 gate blocked: M55_PLATFORM must be ios or android"
    exit 2
  fi
  run_target "$target" || status=1
  shutdown_target "$target"
done
exit "$status"
