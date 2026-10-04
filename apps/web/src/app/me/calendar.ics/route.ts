import { addDays, londonDateTime } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** The member of staff's published shifts as a calendar file (iCalendar), from two weeks ago to eight weeks ahead. */
export async function GET() {
  const { organisationId, businessName, worker } = await requireStaff();
  const today = todayInUk();
  const shifts = await withOrganisation(db, organisationId, (tx) =>
    tx
      .select()
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.workerId, worker.id),
          eq(schema.shift.status, "published"),
          gte(schema.shift.startsAt, new Date(londonDateTime(addDays(today, -14), "00:00"))),
          lt(schema.shift.startsAt, new Date(londonDateTime(addDays(today, 56), "00:00"))),
        ),
      )
      .orderBy(asc(schema.shift.startsAt)),
  );
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VicisRota//Shifts//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(`${businessName} shifts`)}`,
    ...shifts.flatMap((s) => [
      "BEGIN:VEVENT",
      `UID:${s.id}@vicisrota.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(s.startsAt)}`,
      `DTEND:${stamp(s.endsAt)}`,
      `SUMMARY:${escape(`Shift at ${businessName}`)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-shifts.ics"',
      "Cache-Control": "no-store",
    },
  });
}
