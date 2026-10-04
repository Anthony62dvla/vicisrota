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
- The same provider texts invitation links (when a manager ticks "Text the link") and rota changes to staff who turned on "Text me when my rota changes" on their own page. Invitation texts are logged with the link replaced by `<link>`, because the link signs someone in. A failed rota text is logged ("rota change texts failed" or "text message failed") and never undoes the rota change.

## Phone app and offline shifts

VicisRota can be added to a phone's home screen (`src/app/manifest.ts`, icons in `public/`). In production builds a service worker (`public/sw.js`) saves two things on the phone:

- the person's own page, `/me`, refreshed every time they open it with signal, so they can see their shifts with no signal;
- the app's built files under `/_next/static/`, which never change once built.

Nothing else is saved, and manager pages always need the network. Signing out clears the saved page (`src/lib/offline.ts`), and so does opening `/me` after the session has ended.

- **Someone sees an old rota with no "No signal" notice:** their phone thinks it is online but cannot reach the server. The page shows "Updated at" at the bottom.
- **Changing what is saved:** bump `PAGE_CACHE` or `STATIC_CACHE` in `public/sw.js` (and `PAGE_CACHE` in `src/lib/offline.ts`). The old caches are deleted when the new worker starts.
- **Turning it off:** replace `public/sw.js` with a worker that deletes all caches and calls `self.registration.unregister()`.

## Sickness and Statutory Sick Pay

Sickness is stored as leave of kind `sick`. Only approved sickness counts; staff who tap "Off sick?" on their own page create a request that a manager confirms on the Sickness or Leave page. SSP is worked out in `packages/compliance/src/ssp.ts` under the rules from 6 April 2026 (paid from day one, 80% of average weekly earnings capped at the weekly rate, 56-day linking, 28 weeks).

- **The weekly rate changes each April:** add a new entry to `SSP_WEEKLY_RATES` with its `from` date. Never edit an old one.
- **Someone's SSP looks wrong:** open "Change or check" on the Sickness page. It shows the days of the week treated as working days (from their shifts in the 8 weeks before) and the average weekly earnings used. Earnings are estimated from confirmed hours unless a manager entered a figure on the first sickness of the period.
- **Sickness that began before 6 April 2026** is flagged and not calculated; payroll works it out under the old rules.
- The payroll export has a "Statutory Sick Pay (£)" column for the sick days inside the period.
