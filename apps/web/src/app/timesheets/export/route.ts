import { toCsv } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { loadPayroll } from "@/lib/payroll";
import { requestId } from "@/lib/request";
import { parsePeriod } from "../period";

const pounds = (pence: number) => (pence / 100).toFixed(2);

/** Payroll CSV for a pay period, from confirmed hours. Every export is recorded. */
export async function GET(request: Request) {
  const { user, organisationId, businessName } = await requireManager();
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("from"), params.get("to"));
  if ("error" in period) return new Response(period.error, { status: 400 });
  const { from, to } = period;
  const reference = await requestId();

  const { lines, unconfirmed, tipsPence, sspPence, shortNoticePence } = await withOrganisation(db, organisationId, async (tx) => {
    const payroll = await loadPayroll(tx, organisationId, from, to);
    const totalPence = payroll.lines.reduce((s, l) => s + l.grossPence, 0);
    const flagged = payroll.lines.filter((l) => l.findings.length).length;
    await tx.insert(schema.payrollExport).values({
      organisationId,
      periodFrom: from,
      periodTo: to,
      lineCount: payroll.lines.length,
      totalPence,
      flaggedCount: flagged,
      requestId: reference,
      createdByUserId: user.id,
    });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: reference,
      action: "export",
      entity: "payroll",
      entityId: `${from}..${to}`,
      data: { lines: payroll.lines.length, totalPence, flagged, unconfirmed: payroll.unconfirmed },
    });
    return payroll;
  });
  await log("info", "payroll exported", { organisationId, from, to, lines: lines.length, unconfirmed });

  const csv = toCsv([
    [
      "Name",
      "Period start",
      "Period end",
      "Hours worked",
      "Travel hours",
      "Sleep-ins",
      "Sleep-in pay (£)",
      "Hourly rate (£)",
      "Gross pay (£)",
      "Tips (£)",
      "Short-notice pay (£)",
      "Holiday hours built up",
      "Holiday days taken",
      "Holiday hours taken",
      "Sick days",
      "Statutory Sick Pay (£)",
      "Other leave days",
      "Check before paying",
    ],
    ...lines.map((l) => [
      l.name,
      from,
      to,
      l.hours,
      l.travelHours,
      l.sleepIns,
      pounds(l.sleepInPence),
      l.ratesPence.map(pounds).join(" / "),
      pounds(l.grossPence),
      pounds(tipsPence.get(l.workerId) ?? 0),
      pounds(shortNoticePence.get(l.workerId) ?? 0),
      l.holidayHoursAccrued,
      l.holidayDays,
      l.holidayHours,
      l.sickDays,
      pounds(sspPence.get(l.workerId) ?? 0),
      l.otherLeaveDays,
      l.findings.map((f) => f.message).join(" "),
    ]),
  ]);
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "payroll";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-payroll-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
