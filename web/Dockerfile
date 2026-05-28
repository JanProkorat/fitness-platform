# Web SPA container for the dockerised QA harness.
#
# Runs the Vite e2e dev server on :5173 INSIDE the qa-net docker network.
# Does NOT publish to the host — the playwright container is the only
# consumer, and it reaches us via the internal `web:5173` DNS name.
#
# We use `vite --config vite.config.e2e.ts` (dev server with proxy) rather
# than `vite preview` (static-only) because the SPA's axios client uses
# relative paths (baseURL=''), so API requests rely on the dev server's
# proxy to forward /auth, /users, etc to the api service. Using preview
# would require rewiring every API caller to use an absolute URL — out
# of scope for #120.
#
# E2E_API_URL=https://api:8080 — proxy target is the internal api service.

FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first so the layer is cacheable across spec edits.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the SPA. .dockerignore prunes node_modules, dist, etc.
COPY . .

ENV E2E_API_URL=https://api:8080
EXPOSE 5173

# --host 0.0.0.0 so the bridge network can route external connections.
CMD ["npx", "vite", "--config", "vite.config.e2e.ts", "--host", "0.0.0.0", "--port", "5173"]
