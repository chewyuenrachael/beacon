#!/bin/bash
TODAY=$(date +%Y-%m-%d)
CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d= -f2)

echo "=== Pulse daily pipeline for $TODAY ==="

echo ">> Ingesting..."
curl -s -X POST http://localhost:3001/api/ingest/hackernews
curl -s -X POST http://localhost:3001/api/ingest/reddit
curl -s -X POST http://localhost:3001/api/ingest/rss
curl -s -X POST http://localhost:3001/api/ingest/youtube
curl -s -X POST http://localhost:3001/api/ingest/discord

echo -e "\n>> Classifying..."
curl -s -X POST http://localhost:3001/api/classify

echo -e "\n>> Backfilling audience routes..."
curl -s -X POST "http://localhost:3001/api/classify?backfill_audiences=true"

echo -e "\n>> Velocity..."
curl -s -X POST http://localhost:3001/api/velocity

echo -e "\n>> Generating briefs for $TODAY..."
curl -s -X POST http://localhost:3001/api/briefs/audience \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d "{\"date\": \"$TODAY\"}"

echo -e "\n>> Narratives..."
curl -s -X POST http://localhost:3001/api/narratives/snapshots
curl -s -X POST http://localhost:3001/api/narratives/report

echo -e "\n=== Done ==="
