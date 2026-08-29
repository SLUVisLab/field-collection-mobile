#!/usr/bin/env bash
#
# Deterministic iOS Simulator gate runner. Expo's iOS command intentionally
# leaves Metro running, so this script waits for a terminal marker and then
# terminates only the numeric PID it started.
#
# Usage:
#   scripts/run-ios-gate.sh <marker-regex> <out-log> [timeout-seconds]
set -uo pipefail

MARKER="${1:?terminal marker regex required}"
OUT_LOG="${2:?output log path required}"
TIMEOUT="${3:-420}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
EXPO_LOG="${OUT_LOG%.log}.expo.log"
mkdir -p "$(dirname "$OUT_LOG")"
: > "$OUT_LOG"
: > "$EXPO_LOG"

log() { echo "[gate] $*" | tee -a "$OUT_LOG"; }
stop_expo_children() {
  local pid
  for pid in $(ps -axo pid=,ppid= | awk -v parent="$EXPO_PID" '$2 == parent { print $1 }'); do
    kill "$pid" 2>/dev/null || true
  done
}
cleanup() {
  if [ -n "${EXPO_PID:-}" ]; then
    # `npm run` is a wrapper around Expo. Stopping only that wrapper leaves the
    # Metro-owning Node child alive and makes `wait` hang indefinitely.
    stop_expo_children
    kill "$EXPO_PID" 2>/dev/null || true
    stop_expo_children
    wait "$EXPO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

IOS_DEVICE="${EXPO_IOS_DEVICE:-}"
if [ -z "$IOS_DEVICE" ]; then
  # The installed Xcode supports the iOS 18 simulator runtime, while a booted
  # iOS 26 runtime can be present but unavailable as an xcodebuild destination.
  IOS_DEVICE="$(xcrun simctl list devices available | awk -F '[()]' '/iPhone 16/ { print $2; exit }')"
  if [ -n "$IOS_DEVICE" ]; then
    xcrun simctl boot "$IOS_DEVICE" 2>/dev/null || true
    xcrun simctl bootstatus "$IOS_DEVICE" -b
  fi
fi

marker_file_line() {
  if [ -z "${IOS_GATE_BUNDLE_ID:-}" ] || [ -z "${IOS_GATE_MARKER_FILE:-}" ] || [ -z "$IOS_DEVICE" ]; then
    return 1
  fi
  local container
  container="$(xcrun simctl get_app_container "$IOS_DEVICE" "$IOS_GATE_BUNDLE_ID" data 2>/dev/null || true)"
  if [ -z "$container" ] || [ ! -f "$container/Documents/$IOS_GATE_MARKER_FILE" ]; then
    return 1
  fi
  cat "$container/Documents/$IOS_GATE_MARKER_FILE"
}

clear_marker_file() {
  if [ -z "${IOS_GATE_BUNDLE_ID:-}" ] || [ -z "${IOS_GATE_MARKER_FILE:-}" ] || [ -z "$IOS_DEVICE" ]; then
    return 0
  fi
  local container
  container="$(xcrun simctl get_app_container "$IOS_DEVICE" "$IOS_GATE_BUNDLE_ID" data 2>/dev/null || true)"
  if [ -n "$container" ]; then
    rm -f "$container/Documents/$IOS_GATE_MARKER_FILE"
  fi
}

clear_marker_file

if [ -n "$IOS_DEVICE" ]; then
  nohup env EXPO_NO_TYPESCRIPT_SETUP=1 npx expo run:ios --device "$IOS_DEVICE" > "$EXPO_LOG" 2>&1 &
else
  nohup npm run run:ios > "$EXPO_LOG" 2>&1 &
fi
EXPO_PID=$!
log "expo run:ios pid=$EXPO_PID -> $EXPO_LOG"

DEADLINE=$(( $(date +%s) + TIMEOUT ))
STATUS="timeout"
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if grep -Eq "$MARKER" "$EXPO_LOG" 2>/dev/null; then
    STATUS="done"
    break
  fi
  if MARKER_LINE="$(marker_file_line)" && printf '%s\n' "$MARKER_LINE" | grep -Eq "$MARKER"; then
    printf '%s\n' "$MARKER_LINE" >> "$EXPO_LOG"
    STATUS="done"
    break
  fi
  if grep -Eq 'exited with non-zero code|BUILD FAILED|CommandError|xcodebuild.*error' "$EXPO_LOG" 2>/dev/null; then
    STATUS="build-error"
    break
  fi
  sleep 5
done

log "status=$STATUS"
echo "===== MARKER MATCHES =====" | tee -a "$OUT_LOG"
grep -Eh "$MARKER" "$EXPO_LOG" 2>/dev/null | tee -a "$OUT_LOG"
if [ "$STATUS" = "build-error" ]; then
  echo "===== BUILD ERROR TAIL =====" | tee -a "$OUT_LOG"
  tail -n 25 "$EXPO_LOG" | tee -a "$OUT_LOG"
fi

[ "$STATUS" = "done" ]
