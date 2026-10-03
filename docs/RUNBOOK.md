# Runbook: finding and fixing faults

## A user reports a problem

1. Ask for the **reference** shown on their error screen (8 characters, for example `D3E1229F`).
2. Search for it:
   - Sentry: search the `reference` or `request_id` tag.
   - Server logs: every log line is JSON with a `requestId` field.
   - Database: `select * from audit_event where request_id = '<reference>'` shows what that request changed.
3. If a rota was blocked, read `compliance_decision` for that business: it stores the findings, the rule versions
   used and the reason for each block.

## Fixing

1. Write a failing test that reproduces the fault (compliance faults go in `packages/compliance/test`).
2. Fix it, run `npm run typecheck && npm run lint && npm test`, and open a pull request. CI must be green to merge.
3. A change in the law is a **new rule version** with a new `effectiveFrom` date, never an edit to an old version.

## Database changes

Change `packages/db/src/schema`, then run `npm run generate -w @vicisrota/db` to create a migration. Never edit a
migration that has already been applied. Every new business table needs `organisation_id` and must be added to the
row-level security list (see `packages/db/migrations/0001_row_level_security.sql`), with a test.
