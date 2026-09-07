FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/renderer/package.json apps/renderer/package.json
COPY packages/gather-catalog/package.json packages/gather-catalog/package.json
COPY packages/gather-components/package.json packages/gather-components/package.json
RUN npm ci --ignore-scripts

COPY apps/renderer apps/renderer
COPY packages/gather-catalog packages/gather-catalog
COPY packages/gather-components packages/gather-components
COPY src/a2ui/capabilityActionAdapter.js src/a2ui/capabilityActionAdapter.js
COPY src/scientific/contracts.js src/scientific/contracts.js
COPY src/scientific/workflows/segmentAndMeasure.js src/scientific/workflows/segmentAndMeasure.js
RUN npm run build --workspace=gather-renderer

FROM nginx:1.27-alpine

COPY apps/renderer/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/renderer/dist /usr/share/nginx/html

EXPOSE 8080
