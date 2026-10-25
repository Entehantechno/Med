# ================================================================
# MED Lab — multi-stage Docker build
#   Stage 1: build the React client
#   Stage 2: install server deps and run everything on one port
#   The runtime stage runs as the unprivileged `node` user (uid 1000).
# ================================================================

# ---- Stage 1: build client ----
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
# `npm ci` installs exactly the lockfile versions (reproducible, faster than npm install).
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---- Stage 2: server runtime ----
# Pure-JS SQLite (sql.js) — no native build tools needed.
FROM node:20-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/ ./
# bring in the built client so the server can serve it
COPY --from=client-build /app/client/dist /app/client/dist
# The app writes its .env (generated JWT secret), the SQLite DB and uploads
# next to itself, so the unprivileged user needs ownership of the app tree.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Liveness: the API answers /api/health once boot (seed check, migrations) is done.
# The first boot can take a minute on a fresh database, hence the long start period.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# Seed the DB on first run only (if empty), then start the server.
CMD ["sh", "-c", "node src/seed_if_empty.js && node src/index.js"]
