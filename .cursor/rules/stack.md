# Stack

## Commands

- `pnpm install` — install deps
- `pnpm dev` — run dev server at localhost:3000
- `pnpm build` — production build
- `pnpm typecheck` — strict TS check (run before every commit)
- `pnpm lint` — ESLint
- `pnpm test` — vitest unit tests
- `pnpm eval` — run tests/evals/runner.ts

## Environment variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

Optional (post-demo):
- `GITHUB_TOKEN` — for higher rate limits on GitHub API
- `SERPAPI_KEY` — for public statement search
- `SHEERID_API_KEY` — for verification integration

## Database migrations

- Supabase migrations live in `supabase/migrations/`.
- Apply via Supabase CLI: `supabase db push`.
- Naming: `NNN_description.sql` where NNN is sequential.

## External APIs

- **arXiv**: no auth, rate limit 1 req / 3 sec. Implement 3000ms delay between calls.
- **GitHub**: authenticated via `GITHUB_TOKEN` if set, 5000 req/hr. Use GraphQL for collaborator queries.
- **Anthropic**: direct REST, `claude-sonnet-4-20250514`. Use prefill `{` pattern for JSON output (ported from Pulse `lib/classify.ts`).
- **MLH**: no auth, scrape `mlh.io/seasons/2026/events`.

## Deployment

- Vercel for Next.js + cron
- Supabase cloud for DB
- Domain: TBD (`.vercel.app` default for demo)