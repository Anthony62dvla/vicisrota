import { timingSafeEqual } from "node:crypto";
import { lateAlertDue } from "@vicisrota/compliance";
import { lateAlert, overdueAlert } from "@vicisrota/messaging";
import { schema, withOrganisation } from "@vicisrota/db";
import { loadAttendance } from "@/lib/attendance";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { loadLoneShifts } from "@/lib/lone-working";
import { sendShiftReminders } from "@/lib/reminders-send";
import { deleteOldApplications } from "@/lib/hiring";
import { offerCheckIns } from "@/lib/wellbeing";
import { remindChecksDue } from "@/lib/checks-due";
import { syncBands } from "@/lib/stripe";
import { appUrl, textAlertContacts } from "@/lib/sms";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const authorised = (header: string | null) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Run every few minutes by a scheduler. Texts each business's alert contacts about anyone working
 * alone who has missed a check-in, and, where the business has turned it on, about anyone who has not
 * clocked in for a shift. Each missed check-in and each late shift is texted once (see textAlertContacts).
 * It also sends the shift reminders staff have chosen (see sendShiftReminders).
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"))) return Response.json({ error: "Not allowed" }, { status: 401 });

  const now = Date.now();
  // The organisation table is not tenant-scoped; everything after this is read inside each business.
  const businesses = await db
    .select({ id: schema.organisation.id, name: schema.organisation.name, lateAlertMinutes: schema.organisation.lateAlertMinutes })
    .from(schema.organisation);
  let overdue = 0;
  let late = 0;
  let reminders = 0;
  let texts = 0;
  for (const business of businesses) {
    const shifts = await withOrganisation(db, business.id, (tx) =>
      loadLoneShifts(tx, { from: new Date(now - 12 * 3_600_000), to: new Date(now + 3_600_000), now }),
    );
    for (const { shift, status, workerName, clientName, postcode } of shifts) {
      if (status.state !== "overdue" || !status.dueAt) continue;
      overdue++;
      texts += await textAlertContacts(
        business.id,
        "lone_overdue",
        overdueAlert({
          business: business.name,
          person: workerName ?? "Someone",
          what: status.reason ?? "has missed a check-in",
          due: timeFmt.format(new Date(status.dueAt)),
          where: [clientName, postcode].filter(Boolean).join(", ") || null,
          link: appUrl("/lone-working"),
        }),
        `overdue:${shift.id}:${status.dueAt}`,
      );
    }

    reminders += await sendShiftReminders(business, now);
    reminders += await offerCheckIns(business.id, business.name, now);
    reminders += await remindChecksDue(business.id, now);
    await deleteOldApplications(business.id, now);

    if (business.lateAlertMinutes === null) continue;
    // Late texts stop half an hour after a shift ends, so only shifts still running or just finished matter.
    const rows = await withOrganisation(db, business.id, (tx) =>
      loadAttendance(tx, { from: new Date(now - 3_600_000), to: new Date(now), now }),
    );
    for (const r of rows) {
      const shift = { start: r.shift.startsAt.getTime(), end: r.shift.endsAt.getTime() };
      if (!lateAlertDue(r.state, shift, now, business.lateAlertMinutes)) continue;
      late++;
      texts += await textAlertContacts(
        business.id,
        "late",
        lateAlert({
          business: business.name,
          person: r.workerName,
          shift: `${timeFmt.format(r.shift.startsAt)} to ${timeFmt.format(r.shift.endsAt)}`,
          where: [r.roleName, r.place].filter(Boolean).join(", ") || null,
          link: appUrl("/attendance"),
        }),
        `late:${r.shift.id}`,
      );
    }
  }
  await log("info", "alert check ran", { businesses: businesses.length, overdue, late, texts, reminders });
  const billing = await syncBands();
  return Response.json({ businesses: businesses.length, overdue, late, texts, reminders, billing });
}
