# /ship

Pre-commit quality gate and push.

## Steps

1. Run `pnpm typecheck`. Fail if any errors.
2. Run `pnpm lint`. Fail if any errors.
3. Run `pnpm test`. Fail if any test fails.
4. Run `pnpm eval` — report accuracy delta vs. last run. Warn if regressed >5%.
5. `git status` — confirm expected files changed.
6. `git add` only files relevant to this change.
7. Commit with conventional commit message: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
8. `git push`.

## Conventional commit rules

- `feat:` new user-facing feature
- `fix:` bug fix
- `chore:` build, deps, tooling
- `refactor:` internal restructure without behavior change
- `docs:` docs only
- `test:` tests only