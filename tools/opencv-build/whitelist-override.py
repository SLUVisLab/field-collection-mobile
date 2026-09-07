# Appended to OpenCV's own `platforms/js/opencv_js.config.py`, overriding only
# its last line.
#
# Upstream's config enumerates every bound function of nine modules. We do not
# copy that list, edit it, or maintain a parallel one — we append to it, so the
# function lists stay OpenCV's for whichever version is pinned.
#
# The selection here is therefore **by module, not by function**. Every function
# OpenCV binds in `core` and `imgproc` is present in the build. Reaching for
# `cv.threshold`, `cv.GaussianBlur`, `cv.morphologyEx`, `cv.resize`,
# `cv.minAreaRect` or any other imgproc call needs no change to this build:
# write the call and it is there.
#
# An earlier draft of this file listed the eight functions the adapter calls
# today. That would have made every new OpenCV call a build reconfiguration,
# which is a bad trade for a few hundred KB — and worse, a trade paid by
# whoever is midway through unrelated work when they hit it.
#
# `${OPENCV_MODULES}` is substituted at build time from the single module list
# in the Dockerfile, which also drives CMake's `BUILD_LIST`. One list, both
# halves of the trim.
white_list = makeWhiteList([__MODULES__])
