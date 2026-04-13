# Conventions

## Stack

- Next.js 16 App Router, TypeScript strict mode
- Supabase (Postgres + RLS + auth-ready for future)
- Tailwind CSS with design tokens (see components/ui/)
- Claude Sonnet via direct REST API (no SDK)

## Module system

- ES modules. `import` syntax. No `require`.
- Path alias `@/*` → project root.

## Components

- Default to Server Components. Only use `"use client"` when interactivity is needed.
- Ports from Pulse are mostly `"use client"` — refactor to Server where possible.
- Ported Forge primitives (MetricCard, Card, Badge) stay as they are.

## Validation

- Zod for all API route input validation.
- Zod schemas live next to the API route in `schemas.ts`.
- Never trust external data (arXiv, GitHub, Typeform) without validation.

## Error handling

- API routes return `{ error: string, code: string }` with appropriate HTTP status.
- Never swallow errors silently. Every catch block either rethrows or logs with context.
- Client components use error boundaries.

## Naming

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions: `camelCase`
- Types/interfaces: `PascalCase`
- DB tables: `snake_case` plural
- DB columns: `snake_case`

## Observations

- Every entity mutation logs an observation via `logObservation()` from `lib/observations.ts`.
- Never update entity tables directly from API routes. Always go through the observation → projection flow.

## No dead code

- If you port a file from Pulse or Forge and don't use it, delete it.
- `components/_forge-reference/` is reference-only and should be deleted before the demo.