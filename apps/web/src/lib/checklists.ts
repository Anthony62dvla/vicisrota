import { schema, type Transaction as Tx } from "@vicisrota/db";
import { and, asc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";

type Template = typeof schema.checklistTemplate.$inferSelect;
type ShiftLike = { id: string; roleId: string | null; locationId: string | null; startsAt: Date; endsAt: Date };

/** Longest task and handover note. */
export const TASK_MAX = 200;
export const HANDOVER_MAX = 2000;

/** A list applies to a shift when its role and workplace match, or are left open. */
export const appliesTo = (t: Pick<Template, "roleId" | "locationId">, s: Pick<ShiftLike, "roleId" | "locationId">) =>
  (!t.roleId || t.roleId === s.roleId) && (!t.locationId || t.locationId === s.locationId);

/** For each shift: the lists that apply, and which tasks are ticked, by whom and when. */
export const loadShiftTasks = async (tx: Tx, shifts: ShiftLike[]) => {
  if (!shifts.length) return new Map<string, { template: Template; ticked: Map<number, { at: Date; workerId: string | null }> }[]>();
  const templates = await tx.select().from(schema.checklistTemplate).where(isNull(schema.checklistTemplate.archivedAt)).orderBy(asc(schema.checklistTemplate.name));
  const ticks = await tx
    .select()
    .from(schema.checklistTick)
    .where(inArray(schema.checklistTick.shiftId, shifts.map((s) => s.id)));
  return new Map(
    shifts.map((s) => [
      s.id,
      templates
        .filter((t) => appliesTo(t, s))
        .map((template) => ({
          template,
          ticked: new Map(
            ticks.filter((k) => k.shiftId === s.id && k.templateId === template.id).map((k) => [k.item, { at: k.tickedAt, workerId: k.workerId }]),
          ),
        })),
    ]),
  );
};

/**
 * Handover notes for a shift: left by other people at the same workplace (or, with no workplace, anywhere
 * in the business) from a day before it starts until it ends.
 */
export const handoversFor = (tx: Tx, s: ShiftLike, workerId: string) =>
  tx
    .select({ id: schema.handover.id, body: schema.handover.body, createdAt: schema.handover.createdAt, by: schema.worker.fullName })
    .from(schema.handover)
    .leftJoin(schema.worker, eq(schema.handover.workerId, schema.worker.id))
    .where(
      and(
        s.locationId ? eq(schema.handover.locationId, s.locationId) : undefined,
        or(isNull(schema.handover.workerId), ne(schema.handover.workerId, workerId)),
        gte(schema.handover.createdAt, new Date(s.startsAt.getTime() - 24 * 3_600_000)),
        lt(schema.handover.createdAt, s.endsAt),
      ),
    )
    .orderBy(asc(schema.handover.createdAt));
