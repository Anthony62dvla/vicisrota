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

## Text message alerts

- Texts go through any bulk SMS provider's HTTP API, configured with the `SMS_*` variables in `apps/web/.env.example`. With `SMS_PROVIDER` empty, texts are only logged and the Lone working page says so.
- Missed check-ins are found by `GET /api/cron/alerts`, which a scheduler must call every 5 minutes with `Authorization: Bearer $CRON_SECRET`. Calls for help are texted straight away and do not depend on the scheduler.
- Every text is recorded in `sms_message` before it is sent, with `ok`, the provider's reference and any error. Managers see the last 10 under "Recent texts" on the Lone working page. A failed send is also logged at error level ("text message failed").
- If alerts stop arriving: check "Recent texts" for errors, check the provider account has credit, and check the scheduler is calling the alerts route (the log line "alert check ran" appears on each call).
