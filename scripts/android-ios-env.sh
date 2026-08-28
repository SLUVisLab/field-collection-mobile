# Source this file to make the Android + iOS simulator tooling available in the
# current shell:  source experiments/android-ios-env.sh
#
# Why this exists: agent shells are spawned by the already-running editor and do
# NOT source ~/.bash_profile, so env vars added there only take effect after the
# editor is restarted. Sourcing this file gives any shell the same setup now.

export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# JAVA_HOME is already inherited from the editor environment, but set a fallback.
if [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# --- Quick reference ---------------------------------------------------------
# iOS simulators (no env needed, works out of the box):
#   xcrun simctl list devices available
#   xcrun simctl boot "iPhone 16"
#
# Android emulator (headless, detached — good for agent use):
#   emulator -list-avds
#   emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a \
#     -no-window -no-audio -no-snapshot -gpu swiftshader_indirect &
#   adb wait-for-device
#   adb shell getprop sys.boot_completed   # "1" when ready
