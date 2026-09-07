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

# The renderer's only reach into the app tree is
# `src/a2ui/capabilityActionAdapter.js`, whose transitive closure is these two
# directories. Both are module boundaries, so this list changes only when the
# renderer's dependencies genuinely change.
COPY src/a2ui src/a2ui
COPY src/provenance src/provenance

RUN npm run build --workspace=gather-renderer

FROM nginx:1.27-alpine

COPY apps/renderer/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/renderer/dist /usr/share/nginx/html

EXPOSE 8080
