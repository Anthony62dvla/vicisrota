# VicisRota

UK staff scheduling with employment law built in, for small businesses, care providers and hospitality.

## Layout

| Path | What it is |
| --- | --- |
| `packages/compliance` | The UK compliance engine: versioned, dated rules with worked test cases |
| `packages/db` | Postgres schema, migrations and row-level security (Drizzle) |
| `apps/web` | Manager web app (Next.js, Better Auth sign-in, Sentry error tracking) |
| `docs/RUNBOOK.md` | How to find and fix a reported fault |

## Commands

```sh
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in DATABASE_URL and BETTER_AUTH_SECRET
DATABASE_URL=... npm run migrate -w @vicisrota/db
npm run dev --workspace @vicisrota/web

npm test          # compliance rules; database tests run when TEST_DATABASE_URL is set
npm run typecheck
npm run lint
```

The app must connect as a normal (non-superuser) Postgres role, because superusers bypass row-level security.

## Compliance rules

Each rule has an id, a version and an `effectiveFrom` date, and every finding carries the rule version, a plain-English
message, the numbers behind it and the legal reference. A change in the law is a new rule version, not an edit to an old
one, so past decisions can always be explained. Every rule needs worked test cases in `packages/compliance/test`.

Rules so far: rest breaks, daily rest, weekly rest, the 48-hour average with opt-outs, under-18 hours and night work,
and minimum wage bands (April 2025 and April 2026 rates). Holiday accrual helpers cover the 12.07% irregular-hours method
and the 28-day cap.
