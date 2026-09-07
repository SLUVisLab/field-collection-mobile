# The Gather A2UI renderer, built from the repository root as its context.
#
# This image is owned by the `gather/` repository because the renderer depends
# directly on Gather source — `gather-catalog`, `gather-components` and the A2UI
# adapters under `src/a2ui/`. The web repository routes public traffic to the
# running service; it does not build it. See
# docs/planning/deployment-architecture.md.
#
# Copy whole packages and stable directories rather than individual leaf files.
# The previous version enumerated single sources — including
# `src/scientific/contracts.js` and `src/scientific/workflows/segmentAndMeasure.js`
# — and silently rotted the moment that tree was reorganized, with the breakage
# only discoverable at build time on the server. A directory that is a real
# module boundary moves as a unit or not at all.

FROM node:20-alpine AS build

WORKDIR /app

# Workspaces are copied whole before `npm ci`, because the lockfile references
# every workspace and the install fails if one is absent. Copying manifests
# alone would mean re-listing each new package here forever.
COPY package.json package-lock.json ./
COPY packages packages
COPY apps/renderer apps/renderer
COPY patches patches
# `--ignore-scripts` skips the root `postinstall`, so patch-package is invoked
# explicitly. `@a2ui/web_core@0.9.1` publishes no `./v0_9/catalog`,
# `./v0_9/processor`, `./v0_9/bindings`, `./v0_9/common-schemas` or
# `./v0_9/data-context` subpath, and the patch adds both the shim files and the
# `exports` entries that make them resolvable. The renderer entry graph does not
# reach those subpaths today; it would build without this line and break the
# first time it does.
RUN npm ci --ignore-scripts && npx patch-package

# The renderer's reach into the app tree, as a set of module boundaries. Since
# the preview runs real inference it now shares the app's model executor, so
# the closure grew — verified rather than remembered:
#
#   node -e "walk apps/renderer/src/App.jsx" → src/a2ui, src/compute,
#                                              src/media, src/provenance
#
# A directory that is a real module boundary moves as a unit or not at all.
COPY src/a2ui src/a2ui
COPY src/provenance src/provenance
# `scripts/generate-model-catalog.mjs` runs under Node during the build and
# derives public/models.json from the app's own Model Catalog, so the model
# metadata the renderer serves cannot drift from the app's.
COPY src/compute src/compute
# The compatibility report is Gather domain logic the web authoring layer binds.
COPY src/media src/media
COPY src/authoring src/authoring
# The preview installs `.gather` packages through the same reader and the same
# model store the device uses, so the packaging layer is part of its closure.
COPY src/packaging src/packaging
# Composition recognition and binding are served to the wrapper over the
# authoring surface, so the build needs them present. Only three files are
# published; see scripts/generate-model-catalog.mjs.
COPY src/xforms src/xforms

# Canonical model bytes. Only the profiles the browser backend supports are
# copied into the served image by scripts/copy-preview-models.mjs — 4.4MB of
# the 25MB here — and this build stage is discarded.
COPY assets/models assets/models

# The revision is passed in, not discovered: this image has no repository, and
# a build identity nobody can trust is worse than none.
ARG GATHER_REVISION
ENV GATHER_REVISION=${GATHER_REVISION}
RUN npm run build --workspace=gather-renderer

FROM nginx:1.27-alpine

COPY apps/renderer/nginx.conf.template /etc/nginx/templates/default.conf.template
# Runs before nginx's own `20-envsubst-on-templates.sh`, so a renderer with no
# usable CSP or CORS configuration never reaches the point of serving 200.
COPY apps/renderer/docker-entrypoint.d/05-require-renderer-config.envsh /docker-entrypoint.d/
COPY --from=build /app/apps/renderer/dist /usr/share/nginx/html

EXPOSE 8080
