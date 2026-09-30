#!/usr/bin/env bash
# Vercel build: prepare the database, then build Next.js.
#
#   1. apply migrations                (required once a database is connected)
#   2. sync every US-listed stock/ETF  (non-fatal: the daily cron retries)
#   3. create the demo world once      (non-fatal; skipped if it already exists)
#   4. next build
#
# If no database is connected yet, steps 1-3 are skipped so the first deploy
# still succeeds; connect Neon in Vercel → Storage and redeploy.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "⚠️  DATABASE_URL is not set: skipping migrations, stock sync and seed."
  echo "   Connect a database (Vercel → your project → Storage → Neon) and redeploy."
else
  npx prisma migrate deploy
  npm run instruments:sync || echo "⚠️  Stock sync failed; the daily cron will retry."
  npx tsx prisma/seed.ts --if-empty || echo "⚠️  Demo seed failed; run 'npm run db:seed' manually."
fi

npx next build
