import { evaluate, londonParts, weekStart, type Finding } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, inArray } from "drizzle-orm";
import { loadComplianceContext } from "./rota";

/**
 * Runs every compliance rule on the shift's week as if the shift belonged to this person. Only problems
 * that involve this shift and this person count: a picked-up shift must not break the law for them.
 */
export const checkAssignment = async (tx: Transaction, organisationId: string, shiftId: string, workerId: string) => {
  const [shift] = await tx.select().from(schema.shift).where(eq(schema.shift.id, shiftId));
  if (!shift) return null;
  const week = weekStart(londonParts(shift.startsAt.getTime()).date);
  const context = await loadComplianceContext(tx, organisationId, week, { shiftId, workerId });
  const findings: Finding[] = evaluate(context).findings.filter((f) => f.workerId === workerId && f.shiftIds.includes(shiftId));
  return {
    shift,
    blocks: findings.filter((f) => f.severity === "block"),
    warnings: findings.filter((f) => f.severity === "warn"),
  };
};

/** Whether someone may pick up a shift for its job role. Shifts without a role are open to everyone. */
export const canWorkRole = async (tx: Transaction, workerId: string, roleId: string | null) => {
  if (!roleId) return true;
  const [held] = await tx
    .select({ roleId: schema.workerRole.roleId })
    .from(schema.workerRole)
    .where(and(eq(schema.workerRole.workerId, workerId), eq(schema.workerRole.roleId, roleId)));
  return Boolean(held);
};

/**
 * Checks a swap both ways: each person takes the other's shift and gives up their own. Runs every rule on
 * the week of each shift, and keeps only problems that involve one of the two people and one of the two shifts.
 */
export const checkSwap = async (tx: Transaction, organisationId: string, a: { shiftId: string; workerId: string }, b: { shiftId: string; workerId: string }) => {
  const shifts = await tx.select().from(schema.shift).where(inArray(schema.shift.id, [a.shiftId, b.shiftId]));
  const first = shifts.find((s) => s.id === a.shiftId);
  const second = shifts.find((s) => s.id === b.shiftId);
  if (!first || !second) return null;
  const assume = [
    { shiftId: a.shiftId, workerId: b.workerId },
    { shiftId: b.shiftId, workerId: a.workerId },
  ];
  const weeks = [...new Set([first, second].map((s) => weekStart(londonParts(s.startsAt.getTime()).date)))];
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const week of weeks) {
    const context = await loadComplianceContext(tx, organisationId, week, assume);
    for (const f of evaluate(context).findings) {
      if (f.workerId !== a.workerId && f.workerId !== b.workerId) continue;
      if (!f.shiftIds.includes(a.shiftId) && !f.shiftIds.includes(b.shiftId)) continue;
      const key = `${f.ruleId}|${f.workerId}|${f.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  }
  return {
    shifts: { mine: first, theirs: second },
    blocks: findings.filter((f) => f.severity === "block"),
    warnings: findings.filter((f) => f.severity === "warn"),
  };
};
