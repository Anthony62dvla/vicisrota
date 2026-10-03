import { addDays, londonParts, ms, shiftsByWorker } from "../time";
import type { Context, Finding, Rule, Shift, Worker } from "../types";

const shiftDate = (s: Shift) => londonParts(ms(s.start)).date;

const perShift = (ctx: Context, fn: (worker: Worker, shift: Shift) => Finding[]): Finding[] => {
  const workers = new Map(ctx.workers.map((w) => [w.id, w]));
  return [...shiftsByWorker(ctx.shifts)].flatMap(([workerId, shifts]) => {
    const worker = workers.get(workerId);
    if (!worker) throw new Error(`Shift for unknown worker ${workerId}`);
    return shifts.flatMap((s) => fn(worker, s));
  });
};

/** Days before a time-limited right to work ends that a follow-up check is flagged. */
const FOLLOW_UP_WARNING_DAYS = 28;

export const rightToWork: Rule = {
  id: "rtw.check-before-work",
  version: 1,
  title: "Right to work check",
  legalRef: "Immigration, Asylum and Nationality Act 2006, ss15 to 25",
  effectiveFrom: "2008-02-29",
  check(ctx) {
    return perShift(ctx, (worker, shift): Finding[] => {
      const date = shiftDate(shift);
      const valid = (worker.checks ?? []).filter(
        (c) => c.kind === "right_to_work" && c.checkedOn <= date && (!c.expiresOn || c.expiresOn >= date),
      );
      const base = { ruleId: this.id, ruleVersion: this.version, workerId: worker.id, shiftIds: [shift.id], legalRef: this.legalRef };
      if (valid.length === 0) {
        return [
          {
            ...base,
            severity: "block",
            message: `${worker.name} has no valid right to work check for ${date}. Complete the check before their first shift.`,
            evidence: { shiftDate: date },
          },
        ];
      }
      // Only time-limited permission needs a follow-up; an open-ended check has no expiry.
      if (valid.some((c) => !c.expiresOn)) return [];
      const latest = valid.map((c) => c.expiresOn!).sort().at(-1)!;
      if (latest > addDays(date, FOLLOW_UP_WARNING_DAYS)) return [];
      return [
        {
          ...base,
          severity: "warn",
          message: `${worker.name}'s permission to work ends on ${latest}. Do a follow-up check before then.`,
          evidence: { shiftDate: date, expiresOn: latest },
        },
      ];
    });
  },
};

export const enhancedDbs: Rule = {
  id: "care.enhanced-dbs",
  version: 1,
  title: "Enhanced DBS with barred list for regulated activity",
  legalRef: "Health and Social Care Act 2008 (Regulated Activities) Regulations 2014, reg 19 and sch 3",
  effectiveFrom: "2015-04-01",
  check(ctx) {
    if (!ctx.settings?.requireEnhancedDbs) return [];
    return perShift(ctx, (worker, shift): Finding[] => {
      const date = shiftDate(shift);
      const ok = (worker.checks ?? []).some((c) => c.kind === "dbs" && c.dbsLevel === "enhanced_barred" && c.checkedOn <= date);
      if (ok) return [];
      return [
        {
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "block",
          workerId: worker.id,
          shiftIds: [shift.id],
          message: `${worker.name} has no enhanced DBS with barred list check on file, which care work requires.`,
          evidence: { shiftDate: date },
          legalRef: this.legalRef,
        },
      ];
    });
  },
};

export const requiredTraining: Rule = {
  id: "training.required-for-shift",
  version: 1,
  title: "Training the shift needs",
  legalRef: "Health and Social Care Act 2008 (Regulated Activities) Regulations 2014, reg 18(2); Management of Health and Safety at Work Regulations 1999, reg 13",
  effectiveFrom: "2015-04-01",
  check(ctx) {
    return perShift(ctx, (worker, shift): Finding[] => {
      const date = shiftDate(shift);
      return (shift.requiredQualifications ?? []).flatMap((req): Finding[] => {
        const held = (worker.qualifications ?? []).filter((q) => q.id === req.id);
        const current = held.some((q) => (!q.achievedOn || q.achievedOn <= date) && (!q.expiresOn || q.expiresOn >= date));
        if (current) return [];
        const expired = held.map((q) => q.expiresOn).filter((d): d is string => !!d && d < date).sort().at(-1);
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "block",
            workerId: worker.id,
            shiftIds: [shift.id],
            message: expired
              ? `${worker.name}'s ${req.name} expired on ${expired}, and this shift needs it.`
              : `${worker.name} does not have ${req.name}, which this shift needs.`,
            evidence: { qualification: req.name, shiftDate: date, ...(expired ? { expiredOn: expired } : {}) },
            legalRef: this.legalRef,
          },
        ];
      });
    });
  },
};
