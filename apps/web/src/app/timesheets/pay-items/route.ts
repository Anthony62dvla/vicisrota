import { payItemLines, toCsv } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { loadPayroll } from "@/lib/payroll";
import { requestId } from "@/lib/request";
import { parsePeriod } from "../period";

const pounds = (pence: number | null) => (pence === null ? "" : (pence / 100).toFixed(2));

/**
 * Pay items for a pay period, one line per person per kind of pay, for importing into payroll software.
 * Each line carries the person's payroll ID and the business's own name for the pay item. Every export is recorded.
 */
export async function GET(request: Request) {
  const { user, organisationId, businessName } = await requireManager();
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("from"), params.get("to"));
  if ("error" in period) return new Response(period.error, { status: 400 });
  const { from, to } = period;
  const reference = await requestId();

  const items = await withOrganisation(db, organisationId, async (tx) => {
    const payroll = await loadPayroll(tx, organisationId, from, to);
    const [organisation] = await tx.select({ names: schema.organisation.payItemNames }).from(schema.organisation).where(eq(schema.organisation.id, organisationId));
    const items = payItemLines({ ...payroll, names: organisation?.names });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: reference,
      action: "export",
      entity: "pay_items",
      entityId: `${from}..${to}`,
      data: { lines: items.length, people: payroll.lines.length, missingPayrollIds: items.filter((i) => !i.payrollId).length },
    });
    return items;
  });
  await log("info", "pay items exported", { organisationId, from, to, lines: items.length });

  const csv = toCsv([
    ["Payroll ID", "Name", "Pay item", "Units", "Unit", "Rate (£)", "Amount (£)", "Period start", "Period end"],
    ...items.map((i) => [i.payrollId, i.name, i.itemName, i.units, i.unit, pounds(i.ratePence), pounds(i.amountPence), from, to]),
  ]);
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "payroll";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-pay-items-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
