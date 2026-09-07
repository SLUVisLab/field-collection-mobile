#!/usr/bin/env bash
# Build the trimmed, eval-free OpenCV.js and vendor it into the renderer.
#
# Run this only when something in tools/opencv-build/ changes. The artifact is
# committed, so an ordinary renderer build never pays for this.
#
#   ./tools/opencv-build/build.sh
#
# The provenance file written beside the artifact records every input that
# decided it. "Where did this 2 MB blob come from" has one answer, in the repo,
# rather than in whoever's shell history.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
out="$repo/apps/renderer/vendor/opencv"

opencv_version="$(grep -oE 'ARG OPENCV_VERSION=[0-9.]+' "$here/Dockerfile" | cut -d= -f2)"
emsdk_version="$(grep -oE 'ARG EMSDK_VERSION=\S+' "$here/Dockerfile" | cut -d= -f2)"
modules="$(grep -oE 'ARG OPENCV_MODULES=\S+' "$here/Dockerfile" | cut -d= -f2)"

echo "building OpenCV ${opencv_version} (${modules}) with emsdk ${emsdk_version} — this takes a while"
docker build -t gather-opencv-build "$here"

mkdir -p "$out"
container="$(docker create gather-opencv-build)"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker cp "$container:/build/out/bin/opencv.js" "$out/opencv.js"
docker cp "$container:/build/out/bin/opencv_js.wasm" "$out/opencv_js.wasm"

js_sha="$(shasum -a 256 "$out/opencv.js" | cut -d' ' -f1)"
wasm_sha="$(shasum -a 256 "$out/opencv_js.wasm" | cut -d' ' -f1)"

cat > "$out/provenance.json" <<JSON
{
  "opencvVersion": "${opencv_version}",
  "emsdkVersion": "${emsdk_version}",
  "buildFlags": ["-sDYNAMIC_EXECUTION=0", "--build_wasm", "--disable_single_file"],
  "modules": "${modules}",
  "artifacts": {
    "opencv.js": "sha256:${js_sha}",
    "opencv_js.wasm": "sha256:${wasm_sha}"
  }
}
JSON

echo
echo "vendored into apps/renderer/vendor/opencv:"
ls -lh "$out" | tail -n +2
