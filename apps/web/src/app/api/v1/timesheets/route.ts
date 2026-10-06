import { schema, withOrganisation } from "@vicisrota/db";
import { authenticate, period } from "@/lib/api";
import { db } from "@/lib/db";
import { loadPayroll } from "@/lib/payroll";

/** Confirmed hours and gross pay per person for a pay period, the same figures as the payroll export. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const p = period(request);
  if (p instanceof Response) return p;
  const { lines, unconfirmed } = await withOrganisation(db, auth.organisationId, async (tx) => {
    const payroll = await loadPayroll(tx, auth.organisationId, p.from, p.to);
    await tx.insert(schema.auditEvent).values({ organisationId: auth.organisationId, action: "export", entity: "api_timesheets", entityId: `${p.from}..${p.to}` });
    return payroll;
  });
  return Response.json(
    {
      data: lines.map((l) => ({
        staffId: l.workerId,
        hours: l.hours,
        travelHours: l.travelHours,
        sleepIns: l.sleepIns,
        grossPence: l.grossPence,
        holidayDays: l.holidayDays,
        holidayHours: l.holidayHours,
        sickDays: l.sickDays,
        otherLeaveDays: l.otherLeaveDays,
        checkBeforePaying: l.findings.map((f) => f.message),
      })),
      unconfirmedShifts: unconfirmed,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
