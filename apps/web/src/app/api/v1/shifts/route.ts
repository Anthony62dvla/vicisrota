import { addDays, londonDateTime } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { authenticate, json, period } from "@/lib/api";
import { db } from "@/lib/db";

/** Published shifts starting between from and to (UK dates, inclusive). Drafts are left out until published. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const p = period(request);
  if (p instanceof Response) return p;
  const { shifts, breaks, roles } = await withOrganisation(db, auth.organisationId, async (tx) => {
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.status, "published"),
          gte(schema.shift.startsAt, new Date(londonDateTime(p.from, "00:00"))),
          lt(schema.shift.startsAt, new Date(londonDateTime(addDays(p.to, 1), "00:00"))),
        ),
      )
      .orderBy(schema.shift.startsAt);
    return {
      shifts,
      breaks: shifts.length ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id))) : [],
      roles: await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
    };
  });
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  return json(
    shifts.map((s) => ({
      id: s.id,
      staffId: s.workerId,
      start: s.startsAt.toISOString(),
      end: s.endsAt.toISOString(),
      breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
      role: s.roleId ? (roleName.get(s.roleId) ?? null) : null,
      workplaceId: s.locationId,
      kind: s.kind,
      open: !s.workerId,
    })),
  );
}
