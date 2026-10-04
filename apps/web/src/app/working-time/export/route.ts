import { addDays, londonParts, nightHours, toCsv } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { entryAsShift, loadConfirmedHours } from "@/lib/working-time";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A year at a time, so a mistyped date cannot pull every record at once. */
const MAX_DAYS = 366;
const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Working time records as CSV: every confirmed piece of work in the range. Every download is recorded. */
export async function GET(request: Request) {
  const { user, organisationId, businessName } = await requireManager();
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return new Response("Choose a start and end date.", { status: 400 });
  if (to < from) return new Response("The end date must be on or after the start date.", { status: 400 });
  if (to > addDays(from, MAX_DAYS - 1)) return new Response(`Download at most ${MAX_DAYS} days at a time.`, { status: 400 });
  const reference = await requestId();

  const { workers, entries } = await withOrganisation(db, organisationId, async (tx) => {
    const result = { workers: await tx.select().from(schema.worker), entries: await loadConfirmedHours(tx, from, to) };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: reference,
      action: "export",
      entity: "working_time",
      entityId: `${from}..${to}`,
      data: { rows: result.entries.length },
    });
    return result;
  });
  await log("info", "working time exported", { organisationId, from, to, rows: entries.length });

  const byId = new Map(workers.map((w) => [w.id, w]));
  const csv = toCsv([
    ["Name", "Date", "Start", "End", "Unpaid break (minutes)", "Hours worked", "Night hours (23:00 to 06:00)", "Opted out of 48-hour limit", "Date of birth"],
    ...entries.map((e) => {
      const w = byId.get(e.workerId);
      const hours = (e.endsAt.getTime() - e.startsAt.getTime()) / 3_600_000 - e.breakMinutes / 60;
      return [
        w?.fullName ?? "",
        londonParts(e.startsAt.getTime()).date,
        time.format(e.startsAt),
        time.format(e.endsAt),
        e.breakMinutes,
        Math.round(hours * 100) / 100,
        nightHours(entryAsShift(e)),
        w?.optedOutOf48HourLimit ? "Yes" : "No",
        w?.dateOfBirth ?? "",
      ];
    }),
  ]);
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-working-time-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
