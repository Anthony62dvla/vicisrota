import { enhancedDbs, requiredTraining, rightToWork } from "./rules/checks";
import { noShiftDuringLeave } from "./rules/leave";
import { minimumWage } from "./rules/minimumWage";
import { travelTimeMinimumWage } from "./rules/travelTime";
import { dailyRest, restBreak, weeklyAverage48, weeklyRest, youngWorkerHours, youngWorkerNight } from "./rules/workingTime";
import type { Context, Finding, Rule } from "./types";

export const ALL_RULES: Rule[] = [restBreak, dailyRest, weeklyRest, weeklyAverage48, youngWorkerHours, youngWorkerNight, minimumWage,
  rightToWork, enhancedDbs, requiredTraining, noShiftDuringLeave, travelTimeMinimumWage];

export interface Evaluation {
  asOf: string;
  /** Which rule versions were applied, recorded with every decision for the audit trail. */
  rulesApplied: { id: string; version: number }[];
  findings: Finding[];
  /** True when nothing blocks publishing. Warnings still need a recorded reason. */
  publishable: boolean;
}

const inForce = (rule: Rule, asOf: string) => rule.effectiveFrom <= asOf && (!rule.effectiveTo || asOf < rule.effectiveTo);

export const evaluate = (ctx: Context, rules: Rule[] = ALL_RULES): Evaluation => {
  const applied = rules.filter((r) => inForce(r, ctx.asOf));
  const findings = applied.flatMap((rule) => rule.check(ctx));
  return {
    asOf: ctx.asOf,
    rulesApplied: applied.map(({ id, version }) => ({ id, version })),
    findings,
    publishable: !findings.some((f) => f.severity === "block"),
  };
};
