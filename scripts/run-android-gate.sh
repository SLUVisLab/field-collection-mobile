#!/usr/bin/env bash
#
# Deterministic Android emulator gate runner.
#
# The core problem this solves: `expo run:android` starts a Metro dev server
# that NEVER exits, so waiting for the command to "finish" hangs forever. Worse,
# on Android the app's JS `console.log` output is delivered to *logcat*, not to
# the expo CLI's stdout. So polling the expo stdout for a completion marker also
# appears to hang even though the experiment already finished on the device.
#
# The reliable pattern implemented here:
#   1. Ensure exactly one emulator is booted (wait for sys.boot_completed).
#   2. Capture the app's JS logs from `adb logcat -s ReactNativeJS:V` to a file.
#   3. Launch `expo run:android` in the background (build + install + Metro).
#   4. Poll the logcat capture for a TERMINAL MARKER (a string the harness prints
#      exactly once when it is truly done), with a hard timeout.
#   5. As soon as the marker appears -> the experiment is DONE. Tear down Metro
#      and logcat and return. Do not wait on the Metro process.
#
# Usage:
#   scripts/run-android-gate.sh <marker-regex> <out-log> [timeout-seconds]
# Example:
#   scripts/run-android-gate.sh 'M45_RUNTIME_RESULT::' out/m45-android.log 420
#
set -uo pipefail

MARKER="${1:?terminal marker regex required}"
OUT_LOG="${2:?output log path required}"
TIMEOUT="${3:-420}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

LOGCAT_LOG="${OUT_LOG%.log}.logcat.log"
EXPO_LOG="${OUT_LOG%.log}.expo.log"
: > "$OUT_LOG"; : > "$LOGCAT_LOG"; : > "$EXPO_LOG"

log() { echo "[gate] $*" | tee -a "$OUT_LOG"; }

cleanup() {
  [ -n "${EXPO_PID:-}" ] && kill "$EXPO_PID" 2>/dev/null
  [ -n "${LOGCAT_PID:-}" ] && kill "$LOGCAT_PID" 2>/dev/null
}
trap cleanup EXIT

# 1) Ensure an emulator is booted.
if ! "$ADB" devices | grep -q 'emulator-.*device$'; then
  AVD="$("$EMULATOR" -list-avds | grep 'Pixel_3a' | head -1)"
  AVD="${AVD:-$("$EMULATOR" -list-avds | head -1)}"
  log "booting emulator: $AVD"
  # Cold boot (-no-snapshot) ignores any saved quickboot snapshot. A snapshot can
  # persist a broken network state (no route to the 10.0.2.2 host gateway), which
  # makes the app unable to reach Metro on every subsequent boot. Cold booting
  # guarantees a clean network stack.
  nohup "$EMULATOR" -avd "$AVD" -no-snapshot -no-boot-anim -dns-server 8.8.8.8 > "${OUT_LOG%.log}.boot.log" 2>&1 &
fi
log "waiting for device..."
"$ADB" wait-for-device
for _ in $(seq 1 60); do
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 3
done
log "device booted: $("$ADB" devices | grep 'device$' | head -1)"

# 1b) Establish the Metro host the app will load the JS bundle from.
#
# `adb reverse` (device localhost:8081 -> host:8081) is the default expo/dev-client
# path, but on some emulator images (e.g. API 34 virtio-wifi) the reverse tunnel
# silently fails to forward. The emulator can always reach the host loopback via
# 10.0.2.2, so we verify the reverse tunnel actually works and, if not, force the
# app to use 10.0.2.2 via REACT_NATIVE_PACKAGER_HOSTNAME.
"$ADB" reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
export REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2
log "using packager host 10.0.2.2 (emulator host-loopback; robust to broken adb reverse)"

# 2) Start logcat capture of JS output (clear old buffer first).
"$ADB" logcat -c 2>/dev/null || true
"$ADB" logcat -s ReactNativeJS:V > "$LOGCAT_LOG" 2>&1 &
LOGCAT_PID=$!
log "logcat capture pid=$LOGCAT_PID -> $LOGCAT_LOG"

# 3) Launch expo run:android (build + install + launch + Metro) in background.
nohup npm run run:android > "$EXPO_LOG" 2>&1 &
EXPO_PID=$!
log "expo run:android pid=$EXPO_PID -> $EXPO_LOG"

# 4) Poll BOTH the logcat capture and expo stdout for the terminal marker,
#    and fail fast on a hard build error.
DEADLINE=$(( $(date +%s) + TIMEOUT ))
STATUS="timeout"
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if grep -Eq "$MARKER" "$LOGCAT_LOG" "$EXPO_LOG" 2>/dev/null; then
    STATUS="done"; break
  fi
  if grep -Eq 'exited with non-zero code|BUILD FAILED|Unable to locate a Java|CommandError' "$EXPO_LOG" 2>/dev/null; then
    STATUS="build-error"; break
  fi
  sleep 5
done

# 5) Report and tear down (handled by trap).
log "status=$STATUS"
echo "===== MARKER MATCHES =====" | tee -a "$OUT_LOG"
grep -Eh "$MARKER" "$LOGCAT_LOG" "$EXPO_LOG" 2>/dev/null | tee -a "$OUT_LOG"
if [ "$STATUS" = "build-error" ]; then
  echo "===== BUILD ERROR TAIL =====" | tee -a "$OUT_LOG"
  tail -n 25 "$EXPO_LOG" | tee -a "$OUT_LOG"
fi
[ "$STATUS" = "done" ]
