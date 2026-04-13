# /migrate

Generate and apply Supabase migration.

## Steps

1. Read `SCHEMA.md` to confirm target schema state.
2. Write migration SQL to `supabase/migrations/NNN_description.sql` where NNN is the next sequential number.
3. Apply via `supabase db push`.
4. Verify schema by querying Supabase Studio or running `supabase db diff`.
5. If drift, adjust until `db diff` is clean.
6. Commit migration file with message `chore: migrate <description>`.

## Guardrails

- Never destructively alter an existing column without explicit human approval.
- Adding columns is safe.
- Renaming requires a two-phase migration: add new, dual-write, drop old.
- Observations table columns are frozen after first deploy.