# ================================================================
# MED Lab — multi-stage Docker build
#   Stage 1: build the React client
#   Stage 2: install server deps and run everything on one port
# ================================================================

# ---- Stage 1: build client ----
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: server runtime ----
# Pure-JS SQLite (sql.js) — no native build tools needed.
FROM node:20-slim AS runtime
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
# bring in the built client so the server can serve it
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Seed the DB on first run only (if empty), then start the server.
CMD ["sh", "-c", "node src/seed_if_empty.js && node src/index.js"]
