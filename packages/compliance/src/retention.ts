import { addDays } from "./time";
import type { LocalDate } from "./types";

export const RETENTION_LEGAL_REF =
  "UK GDPR, Article 5(1)(e) (kept no longer than necessary); Limitation Act 1980, s 5 (6 years for contract claims); Immigration, Asylum and Nationality Act 2006 (right to work records for 2 years after employment ends)";

const years = (date: LocalDate, n: number): LocalDate => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  // 29 February moves to 28 February in a year that is not a leap year.
  const target = new Date(Date.UTC(y + n, m - 1, d));
  return target.getUTCMonth() === m - 1 ? target.toISOString().slice(0, 10) : addDays(`${y + n}-${String(m).padStart(2, "0")}-01`, 27);
};

/** What VicisRota deletes, and when. Shown to managers and staff in plain words. */
export const RETENTION_RULES = [
  {
    id: "messages",
    after: "1 year",
    what: "App notifications and the record of text messages sent",
  },
  {
    id: "leaver-minimise",
    after: "2 years after someone leaves",
    what:
      "Their right to work and DBS check records, wellbeing check-ins, times they can't work, agreed adjustments, their \"how I work best\" profile, mobile number, notifications, swap and pick-up requests, and visa, agency, licence, permit and Sunday working details",
  },
  {
    id: "leaver-delete",
    after: "6 years after someone leaves",
    what: "Everything else about them, including shifts worked, pay, holiday and sickness records. Rota shifts stay, without their name",
  },
] as const;

export const MESSAGES_KEPT_DAYS = 365;

/** Which deletion step is due for someone who has left. */
export const retentionStage = (leftOn: LocalDate | null, today: LocalDate): "keep" | "minimise" | "delete" => {
  if (!leftOn) return "keep";
  if (today >= years(leftOn, 6)) return "delete";
  if (today >= years(leftOn, 2)) return "minimise";
  return "keep";
};

/** The dates each step happens for someone who left on this day. */
export const retentionDates = (leftOn: LocalDate) => ({ minimiseOn: years(leftOn, 2), deleteOn: years(leftOn, 6) });
