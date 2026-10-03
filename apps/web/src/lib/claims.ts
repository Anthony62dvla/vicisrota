import { evaluate, londonParts, weekStart, type Finding } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { eq } from "drizzle-orm";
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
