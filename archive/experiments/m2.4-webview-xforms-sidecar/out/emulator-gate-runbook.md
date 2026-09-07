# Emulator Gate Runbook — running RN/Expo experiments and knowing when they're done

This is the definitive procedure for running our device experiments (M3/M4.x gates)
on iOS Simulator and Android emulator, **reliably detecting completion**, and then
continuing with analysis. Follow this instead of "start the run and watch the log
stream," which is what makes agents appear to hang forever.

## The core problem (why runs look like they hang)

`expo run:ios` / `expo run:android` do **not** exit. They build, install, launch the
app, then start a **Metro dev server that stays running indefinitely**. If you wait for
the command to "finish," you wait forever. Two consequences:

1. **Never block on the run command itself.** It will never return on its own.
2. **On Android, the app's `console.log` does NOT reliably reach the expo CLI stdout** —
   JS logs go to **logcat** (`ReactNativeJS` tag). Polling expo stdout for a completion
   string can therefore also appear to hang even though the experiment already finished
   on the device.

## The reliable pattern: emit a terminal marker, then poll for it

**1. Make the harness print exactly one unambiguous terminal marker when truly done.**
Our harnesses print a single line that no earlier step prints, e.g.:

```
M45_RUNTIME_RESULT::{...full JSON summary...}
```

plus fail-safe markers (`M45_RUNTIME_CRASH::`, `M45_RUNTIME_HANG::`) and a watchdog
`setTimeout` so a stuck run still self-reports instead of hanging silently. Design rules:

- one terminal marker, printed once, at the very end (after the last await);
- a watchdog that emits a HANG marker + summary if the flow stalls;
- guard the effect so it runs once (StrictMode/double-mount safe).

**2. Detect completion by polling the marker, not by waiting on the process.**

### iOS (simplest — stdout carries JS logs)

```bash
npm run run:ios          # foreground; JS "LOG M45_..." lines stream to stdout
# As soon as you SEE `M45_RUNTIME_RESULT::`, the run is done. Stop the process.
```

Because iOS streams JS logs to the CLI, a foreground run with a bounded initial wait is
fine: read output, look for the terminal marker, then stop the process. Don't keep
reading once the marker has appeared — nothing more is coming but Metro noise.

### Android (must read logcat, not expo stdout)

Use the runner script — it encapsulates the whole pattern and **returns on the marker**:

```bash
scripts/run-android-gate.sh 'M45_RUNTIME_RESULT::' out/m45-android.log 480
```

What it does (and what to replicate if doing it by hand):

1. Ensure exactly one emulator is booted; wait for `sys.boot_completed == 1`.
2. `adb logcat -c` (clear), then `adb logcat -s ReactNativeJS:V > capture.log &`.
3. `expo run:android &` (build + install + launch + Metro), backgrounded.
4. Poll **`capture.log`** (and expo stdout) every few seconds for the marker regex,
   with a hard timeout; also fail-fast on `exited with non-zero code` / `BUILD FAILED`
   / `Unable to locate a Java`.
5. On marker (or timeout): print the matched line(s) and **tear down Metro + logcat**
   via an EXIT trap. The emulator is left running for reuse.

The script's exit code is `0` only if the terminal marker was seen, so it composes in
CI-style checks.

## How to tell "it's really done" vs "still running"

| Signal | Meaning |
|--------|---------|
| Terminal marker (`*_RESULT::` / `*_DONE::`) present in the capture | ✅ Done — proceed to analysis. |
| Only `*_STEP_START::X` with no matching `*_STEP_OK::X`, no new lines for a while | Stuck **inside step X** (e.g. a hanging network POST). Investigate that step. |
| `*_CRASH::` / `*_HANG::` present | Harness self-reported failure — read the payload. |
| `adb shell pidof <appId>` empty + no terminal marker | App exited/killed mid-run (external close, native crash). Check `adb logcat -d` for `FATAL`/`AndroidRuntime`. |
| No JS markers at all yet, expo log still in Gradle tasks | Still building — normal for first build; wait. |

## Environment gotchas (must-set, learned the hard way)

- **Node/npm not on the spawned shell's PATH.** Prepend the nvm bin explicitly:
  `export PATH=$HOME/.nvm/versions/node/v22.15.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH`
  (the system `/usr/local/bin/node` here is too old for Expo).
- **Android build needs a JDK.** There is no system Java; use Android Studio's bundled
  JBR: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- **Set `ANDROID_HOME`** (`$HOME/Library/Android/sdk`) so `adb`/`emulator` resolve.
- **UTF-8 locale** for pod/expo flows: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- **AVD choice matters for networking.** A cold-booted `Nexus_6_API_34` stalled on the
  multipart submit POST; the `Pixel_3a_API_34…arm64-v8a` AVD (used for M4.4's byte-verified
  submit) is the known-good device. Prefer it for network-bound gates.

## Android "Unable to load script" — diagnose the network, not the harness

Symptom: the app shows **"Unable to load script. Make sure you're running Metro or that
your bundle 'index.android.bundle' is packaged correctly for release."** even though the
build succeeded, Metro is up, and `adb reverse --list` shows the tunnel.

**Do not** just relaunch. Diagnose in this order (all while Metro is up):

1. **Metro builds the bundle?** `curl 'http://localhost:8081/index.bundle?platform=android&dev=true' | head -c 200` → valid JS means your code/bundle is fine (rules out a JS/import error).
2. **Can the device reach the host gateway?** The emulator has `nc` (toybox):
   `adb shell 'printf "GET /status HTTP/1.0\r\n\r\n" | nc -w 4 10.0.2.2 8081'`
   - `HTTP/1.1 200 ... packager-status:running` → host loopback works; the problem is the
     reverse tunnel (see step 4).
   - **"Network is unreachable"** → the emulator has **no working route** (the real root
     cause we hit). Check `adb shell ip route` — if there's no usable route to `10.0.2.2`,
     the emulator booted from a **bad quickboot snapshot**.
3. **Fix a broken network snapshot with a COLD boot.** `-no-snapshot-save` still *loads*
   the saved snapshot, so a broken-network snapshot recurs on every boot. Cold boot to
   ignore it: `emulator -avd <AVD> -no-snapshot -no-boot-anim -dns-server 8.8.8.8`.
   Verify recovery: `adb shell ping -c1 8.8.8.8` succeeds and `nc 10.0.2.2 8081` returns
   Metro's 200.
4. **Reverse tunnel silently not forwarding?** On some API-34 (virtio-wifi) images,
   `adb reverse tcp:8081 tcp:8081` reports success and lists, but `nc localhost 8081` from
   the device returns nothing. Don't rely on it — force the app to load from the host
   loopback alias instead: `export REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2` before
   `expo run:android`. (`10.0.2.2` is the emulator's alias for the host's `127.0.0.1`.)

`scripts/run-android-gate.sh` now bakes in both fixes: it cold-boots (`-no-snapshot`) and
sets `REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2`, so the emulator gate is deterministic.


## Clean teardown (avoid emulator/simulator sprawl)

Kill by **numeric PID** (a name-based `emu kill` phrase is blocked by the shell guard):

```bash
# Android emulator:
ps aux | grep -i 'qemu-system' | grep -v grep | awk '{print $2}'   # -> PID
kill <PID>
# iOS simulators:
xcrun simctl shutdown all
ps aux | grep -i 'Simulator.app/Contents/MacOS' | grep -v grep | awk '{print $2}'  # -> PID
kill <PID>
# Metro/expo left over:
ps aux | grep -i 'expo run' | grep -v grep | awk '{print $2}'      # -> PID
kill <PID>
```

Verify clean: `adb devices` shows none, and no `qemu-system` / `Simulator` / `expo run`
processes remain.

## TL;DR

1. Harness prints **one terminal marker** at the end (+ watchdog/crash markers).
2. **Never wait for `expo run:*` to exit** — it won't.
3. iOS: read stdout for the marker. Android: read **logcat** (`ReactNativeJS`) for it.
4. Poll the capture for the marker with a **timeout**; stop as soon as it appears.
5. Tear down Metro/logcat; reuse or kill the emulator by numeric PID.
