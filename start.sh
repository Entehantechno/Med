#!/usr/bin/env bash
# One-shot setup + run (production mode: single server serves everything)
set -e
cd "$(dirname "$0")"

echo "📦 Installing backend deps..."
(cd server && npm install)

echo "📦 Installing frontend deps..."
(cd client && npm install)

echo "🏗️  Building frontend..."
(cd client && npm run build)

echo "🌱 Seeding database..."
(cd server && npm run seed)

echo "🚀 Starting server on http://localhost:4000"
(cd server && npm start)
