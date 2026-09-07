/**
 * Loads the vendored OpenCV build — once, and only when something measures.
 *
 * Two things are different about this build, and both are the point:
 *
 * ```text
 * -sDYNAMIC_EXECUTION=0   Embind builds invokers as closures, not `new Function`,
 *                         so the renderer's CSP needs no 'unsafe-eval'
 * BUILD_LIST=core,imgproc only the modules image measurement is made of
 * ```
 *
 * See `tools/opencv-build/` for how it is produced and what is pinned. The
 * artifact is committed, so nothing here compiles anything.
 *
 * **Lazy, deliberately.** Most of what the preview does — rendering a surface,
 * capturing an image, running a model — never touches OpenCV, and the previous
 * static import made every visitor download it before the first paint. This
 * module is reached only from `openCvReady()`, which the measurement adapter
 * awaits at its entry points, so the cost lands on the first measurement rather
 * than on page load.
 *
 * It is loaded rather than imported because OpenCV emits a classic script with
 * `-sMODULARIZE=1 -sEXPORT_NAME=cv`: a factory on the global, not an ES module.
 * Bundling it would also defeat the laziness.
 */
/** Where the browser fetches it from — `apps/renderer/public/opencv/`. */
const BROWSER_DIRECTORY = 'opencv/';

/** Where it sits in the repo, for Node (the measurement tests run there). */
const NODE_PATH = '../../../vendor/opencv/opencv.js';

const inBrowser = () => typeof document !== 'undefined';

/**
 * OpenCV wraps Emscripten's `MODULARIZE` factory in a UMD shim that **calls it
 * for you** — the file's last statement is `return cv(Module)`. So neither
 * loader below gets a factory to configure; both get the instance the shim
 * already made, and configuration has to be in place before the file runs.
 *
 * That is why `Module` is assigned first. It is the object the shim passes in,
 * and it is the only seam for `locateFile` — which the glue needs to find its
 * sibling `.wasm`, since the default resolves against the page rather than
 * against this directory.
 *
 * `cv(Module)` resolves to the module once its WASM is ready, so the awaited
 * value already has the bound types on it. Older Emscripten returned the module
 * synchronously instead; awaiting covers both, and `Mat` is the honest test of
 * which happened.
 */
const instantiated = async (exported) => {
  const module = await exported;
  if (module.Mat) return module;
  await new Promise((resolve) => {
    module.onRuntimeInitialized = resolve;
  });
  return module;
};

const loadInBrowser = async () => {
  const base = new URL(BROWSER_DIRECTORY, document.baseURI);
  const source = new URL('opencv.js', base).href;

  const previous = globalThis.Module;
  globalThis.Module = { locateFile: (file) => new URL(file, base).href };

  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.onload = resolve;
      script.onerror = () =>
        reject(
          new Error(
            `Could not load OpenCV from ${source}. It is a build artifact copied ` +
              'into public/ by scripts/copy-opencv.mjs — run the renderer build.'
          )
        );
      document.head.append(script);
    });
    return await instantiated(globalThis.cv);
  } finally {
    // The shim reads a global, so one had to exist; leaving it behind would be
    // a surprise for anything else on the page that looks for `Module`.
    globalThis.Module = previous;
  }
};

// `node:module` is imported inside this branch, not at the top of the file:
// a static import would make the browser bundle try to resolve a Node builtin,
// which fails the renderer build rather than this function.
//
// No `locateFile` here — the glue falls back to `__filename`, and the `.wasm`
// really is beside it in the repo.
const loadInNode = async () => {
  const { createRequire } = await import(/* @vite-ignore */ 'node:module');
  return instantiated(createRequire(import.meta.url)(NODE_PATH));
};

let loading = null;

/** The loaded OpenCV namespace. Concurrent callers share one load. */
export const loadOpenCv = () => {
  loading ??= inBrowser() ? loadInBrowser() : loadInNode();
  return loading;
};
