import { timingSafeEqual } from "node:crypto";
import { overdueAlert } from "@vicisrota/messaging";
import { schema, withOrganisation } from "@vicisrota/db";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { loadLoneShifts } from "@/lib/lone-working";
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
 * alone who has missed a check-in. Each missed check-in is texted once (see textAlertContacts).
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"))) return Response.json({ error: "Not allowed" }, { status: 401 });

  const now = Date.now();
  // The organisation table is not tenant-scoped; everything after this is read inside each business.
  const businesses = await db.select({ id: schema.organisation.id, name: schema.organisation.name }).from(schema.organisation);
  let overdue = 0;
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
  }
  await log("info", "alert check ran", { businesses: businesses.length, overdue, texts });
  return Response.json({ businesses: businesses.length, overdue, texts });
}
