import { londonParts, remindersDue } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { reminderText } from "@vicisrota/messaging";
import { and, eq, gt, gte, isNotNull, lt, lte } from "drizzle-orm";
import { db } from "./db";
import { appUrl, sendTexts } from "./sms";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });

/**
 * Texts the shift reminders people have asked for, for one business. Each reminder has its own
 * dedupe key, so running this every few minutes sends each one once. No reminder is sent for a day
 * the person has approved leave or sickness. Returns how many texts were sent.
 */
export const sendShiftReminders = async (business: { id: string; name: string }, now: number): Promise<number> => {
  const rows = await withOrganisation(db, business.id, async (tx) => {
    const shifts = await tx
      .select({ shift: schema.shift, mobile: schema.worker.mobile, preferences: schema.worker.preferences, role: schema.jobRole.name, place: schema.location.name })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .leftJoin(schema.jobRole, eq(schema.shift.roleId, schema.jobRole.id))
      .leftJoin(schema.location, eq(schema.shift.locationId, schema.location.id))
      .where(
        and(
          eq(schema.shift.status, "published"),
          isNotNull(schema.worker.mobile),
          gt(schema.shift.startsAt, new Date(now)),
          // The evening reminder is the earliest: at most 30 hours ahead.
          lt(schema.shift.startsAt, new Date(now + 30 * 3_600_000)),
        ),
      );
    if (!shifts.length) return [];
    const days = shifts.map((r) => londonParts(r.shift.startsAt.getTime()).date).sort();
    const leave = await tx
      .select({ workerId: schema.leaveRequest.workerId, startsOn: schema.leaveRequest.startsOn, endsOn: schema.leaveRequest.endsOn })
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.status, "approved"), lte(schema.leaveRequest.startsOn, days.at(-1)!), gte(schema.leaveRequest.endsOn, days[0]!)));
    return shifts.filter((r) => {
      const day = londonParts(r.shift.startsAt.getTime()).date;
      return !leave.some((l) => l.workerId === r.shift.workerId && l.startsOn <= day && l.endsOn >= day);
    });
  });

  let sent = 0;
  const today = londonParts(now).date;
  for (const r of rows) {
    const due = remindersDue(
      { evening: r.preferences.remindEvening, beforeMinutes: r.preferences.remindBeforeMinutes },
      { id: r.shift.id, start: r.shift.startsAt.getTime() },
      now,
    );
    for (const reminder of due) {
      const isToday = londonParts(r.shift.startsAt.getTime()).date === today;
      const when = `${isToday ? "today" : `tomorrow, ${dayFmt.format(r.shift.startsAt)}`}, ${timeFmt.format(r.shift.startsAt)} to ${timeFmt.format(r.shift.endsAt)}`;
      const body = reminderText({ business: business.name, when, detail: [r.role, r.place].filter(Boolean).join(" at ") || null, note: r.shift.note, link: appUrl("/me") });
      sent += await sendTexts(business.id, "reminder", [{ to: r.mobile!, body }], reminder.key);
    }
  }
  return sent;
};
