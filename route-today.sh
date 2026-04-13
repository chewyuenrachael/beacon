#!/bin/bash
TODAY=$(date +%Y-%m-%d)
echo "Routing mentions for $TODAY to all audiences..."

SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)

curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/route_today" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null || echo "Run the SQL manually in Supabase"

echo "Done. Now generate briefs."
