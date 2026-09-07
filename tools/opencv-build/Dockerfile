# Build OpenCV.js without `eval`, and with only the modules Gather calls.
#
# Why this exists
# ---------------
# The renderer's CSP had to grant `'unsafe-eval'` for `@techstark/opencv-js`.
# That is not a packaging accident: Embind's invoker layer builds the `cv.Mat`
# surface with `new Function`, so no bundler setting or patch removes it. The
# only lever is Emscripten's, at compile time — `-sDYNAMIC_EXECUTION=0` selects
# Embind's closure-based invokers instead (embind.js guards them with
# `#if DYNAMIC_EXECUTION == 0`), and then nothing in the output evaluates a
# string.
#
# `wasm-unsafe-eval` is still required and still narrow: it permits WebAssembly
# compilation and not JavaScript `eval`. That grant stays.
#
# Why it is a separate, explicitly-run build
# ------------------------------------------
# Compiling OpenCV under Emscripten takes a long time. Putting it in the
# renderer's Dockerfile would put that on every renderer build, immediately
# after we spent a cycle getting renderer rebuilds down to 47s. So this
# produces a pinned artifact, committed with its provenance, rebuilt only when
# the pins below change.
#
#   ./tools/opencv-build/build.sh
#
# Why emsdk is installed rather than pulled as an image
# -----------------------------------------------------
# `emscripten/emsdk` publishes multi-arch images only for `latest`; every
# pinned tag is amd64-only. On an arm64 machine that means QEMU, and the
# difference is not marginal — a CMake feature probe that takes under a second
# natively took 9-11 seconds emulated, across hundreds of probes and thousands
# of translation units.
#
# Pinning the *toolchain version* and letting emsdk fetch its own per-arch
# binaries is both faster and a better definition of reproducible: what decides
# the output is Emscripten 3.1.64 and OpenCV 4.12.0, not which CPU ran them.
FROM debian:bookworm-slim

# Emscripten. 3.1.64 publishes linux-arm64 and linux-x64 binaries, so this
# builds natively on either.
ARG EMSDK_VERSION=3.1.64

# 4.12.0 is not a preference — it is what the device runs.
# `react-native-fast-opencv` bundles OpenCV 4.12.0 (android/build.gradle), and
# Capability parity is the reason this library is in the browser at all. Two
# runtimes on one version is the whole point; a browser build that drifted to a
# different minor would be a parity claim we had stopped checking.
ARG OPENCV_VERSION=4.12.0

# The modules built and bound — the whole trim, in one list.
#
# This is deliberately module-level. Everything OpenCV binds in these modules
# is available to the renderer, so adding a new `cv.` call is writing the call,
# not editing this file. Only reaching into a genuinely different domain
# (objdetect, video, dnn, calib3d) touches this line, and that is an
# architectural decision rather than an incidental one.
#
# `core` and `imgproc` are what image measurement is made of, and Gather runs
# its models through ONNX Runtime rather than `cv.dnn`, so the boundary is not
# expected to move often. When it does: add the module here and rebuild. CMake's
# `BUILD_LIST` and the Embind whitelist are both generated from this value, so
# there is no second place to forget.
ARG OPENCV_MODULES=core,imgproc

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates git python3 python3-distutils cmake make build-essential xz-utils \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/emscripten-core/emsdk.git /emsdk \
 && /emsdk/emsdk install ${EMSDK_VERSION} \
 && /emsdk/emsdk activate ${EMSDK_VERSION}

# emsdk_env.sh puts emcc, emcmake and its own node on PATH. Sourcing it per
# layer is the supported way in; baking the paths in by hand means guessing the
# bundled node's version directory.
SHELL ["/bin/bash", "-c"]

# Shallow, single-tag clone: the build needs one commit's worth of source, and
# a full history is several GB of nothing this uses.
RUN git clone --depth 1 --branch ${OPENCV_VERSION} \
      https://github.com/opencv/opencv.git /opencv

# Build the Embind whitelist by *appending* to OpenCV's own config rather than
# replacing it: Python takes the last assignment, so upstream's per-module
# function lists are reused verbatim and only the module selection is ours.
COPY whitelist-override.py /build/whitelist-override.py
RUN modules="$(echo "${OPENCV_MODULES}" | tr ',' ' ' | sed 's/ /, /g')" \
 && cat /opencv/platforms/js/opencv_js.config.py > /build/opencv_js.config.py \
 && sed "s/__MODULES__/${modules}/" /build/whitelist-override.py >> /build/opencv_js.config.py \
 && tail -1 /build/opencv_js.config.py

# `--build_wasm` gives a real `.wasm` alongside a small JS glue file, rather
# than upstream's asm.js-shaped single blob. It is also what makes the payload
# claim measurable: the JS shrinks to glue, and the numeric code moves into
# WebAssembly where `wasm-unsafe-eval` already covers it.
#
# `BUILD_LIST` is the CMake half of the trim. The whitelist decides what gets
# *bound*; this decides what gets *compiled*, and OpenCV resolves module
# dependencies from it. Both halves come from OPENCV_MODULES, so they cannot
# drift into a build that compiles what it will not bind.
#
# `js` is appended rather than listed in OPENCV_MODULES because it is not a
# module anyone selects — it is OpenCV's binding generator, the thing that
# emits opencv.js at all. `BUILD_LIST` excludes whatever it does not name, and
# build_js.py's own `-DBUILD_opencv_js=ON` does not survive that, so leaving it
# out yields a successful build that produces no artifact.
RUN source /emsdk/emsdk_env.sh \
 && emcmake python3 /opencv/platforms/js/build_js.py /build/out \
      --build_wasm \
      --disable_single_file \
      --config /build/opencv_js.config.py \
      --build_flags="-sDYNAMIC_EXECUTION=0" \
      --cmake_option="-DBUILD_LIST=${OPENCV_MODULES},js" \
 && test -f /build/out/bin/opencv.js

# Prove the point of the whole build before the artifact leaves the image.
#
# This is deliberately a build step and not a later gate: an opencv.js that
# still evaluates strings is not a thing to publish and then check, because the
# CSP change that depends on it would be the thing that failed, three steps
# away from the cause.
COPY assert-no-eval.mjs /build/assert-no-eval.mjs
RUN source /emsdk/emsdk_env.sh \
 && node /build/assert-no-eval.mjs /build/out/bin/opencv.js
