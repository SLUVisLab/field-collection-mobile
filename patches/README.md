# node_modules patches

Applied by `patch-package` from the root `postinstall`. The renderer image
applies them explicitly (`apps/renderer/Dockerfile`) because its install runs
with `--ignore-scripts`.

## `@a2ui/web_core@0.9.1`

Adds five `src/v0_9/*.js` re-export shims **and the `exports` entries that make
them resolvable**:

```text
./v0_9/bindings        ./v0_9/catalog        ./v0_9/common-schemas
./v0_9/data-context    ./v0_9/processor
```

The published package exposes only `.`, `./v0_8`, `./v0_9`,
`./v0_9/basic_catalog` and three `*` wildcards under the v0_8 tree, so every
Gather A2UI module that reaches into v0_9 internals depends on this patch.

**Regenerate with `npx patch-package @a2ui/web_core --exclude 'a^'`.** By
default patch-package excludes `package.json` from the diff, so a plain
regeneration silently drops the `exports` half of this patch. That happened
once: the shim files were captured, the `exports` entries were not, and the
working tree only kept passing because a hand-edited `node_modules` survived in
place. The next `npm ci` produced `ERR_PACKAGE_PATH_NOT_EXPORTED` on seven test
files. `'a^'` is a regexp that cannot match, i.e. exclude nothing.

`gates/M90WebCoreHermesGateApp.js` still deep-imports
`@a2ui/web_core/src/v0_9/basic_catalog/components/basic_components.js`, which
no `exports` entry covers. It runs under Metro, which is more permissive than
Node's resolver; move it onto a patched subpath if it ever breaks.

## `onnxruntime-react-native@1.24.3`

See `patches/onnxruntime-react-native+1.24.3.patch`.
