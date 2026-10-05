# How VicisRota talks

Everything people read in VicisRota follows the Easy Read approach. Many of our users are neurodivergent,
have a learning disability, are tired after a long shift, or speak English as a second language. Plain words
help all of them, and nobody is worse off for them.

## The rules

1. **One idea per sentence.** Aim for 15 words. Over 20, split it.
2. **Everyday words.** "Holiday for the year", not "entitlement". "Legal minimum", not "statutory minimum".
   "A share of it", not "pro rata".
3. **Keep legal names, then explain them.** "Statutory Sick Pay" is what payslips and HMRC call it, so keep
   it, but say what it means first: "the sick pay the law says each person must get".
4. **Talk to the person.** "You", "your shifts". Say who does what: "your manager will…", not "it will be…".
5. **Say what to do, not what went wrong.** "Enter a date of birth", not "Invalid date".
6. **Questions are fine.** "Worried about someone's safety?" is easier to take in than a long "If…" clause.
7. **No blame, no alarm.** "Skipped. That is fine." Asking for help or an adjustment never counts against anyone.
8. **Numbers as digits**, times on the 24-hour clock in tables (09:00), and dates written out (5 October 2026).
9. **No Latin or abbreviations**: no "e.g.", "i.e.", "N/A" or "via".
10. **Buttons say what happens**: "Send concern", "Take Sam on", not "Submit" or "OK".

## Languages

Staff pages are translated into Welsh, Polish and Romanian (`apps/web/src/lib/i18n`). Add any new sentence
staff read to `en.ts` first; the type checker then lists every language that needs it. Translations are
checked by a native speaker before release.
