"use server";

import { addDays, dailyHours, londonDateTime, londonParts, matchEmployees, PAY_ITEMS } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { clockSummaries } from "@/lib/clock";
import { periodBounds } from "@/lib/payroll";
import { requestId } from "@/lib/request";
import { xeroClient, type XeroEarningsRate, type XeroEmployee } from "@/lib/xero";
import { parsePeriod } from "./period";

const TIME = /^\d{2}:\d{2}$/;
const MINUTE = 60_000;

export type FormState = { error?: string; ok?: string };

/** Confirms worked shifts exactly as they were on the rota. */
export async function confirmAsRostered(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const ids = [...new Set(form.getAll("shiftId").map(String))];
  if (!ids.length) return { error: "There are no shifts to confirm." };

  const count = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(and(inArray(schema.shift.id, ids), eq(schema.shift.status, "published"), lt(schema.shift.startsAt, new Date())));
    if (!shifts.length) return 0;
    const breaks = await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id)));
    const now = new Date();
    const rows = await tx
      .insert(schema.timeEntry)
      .values(
        shifts.map((s) => ({
          organisationId,
          workerId: s.workerId!,
          shiftId: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          breakMinutes: Math.round(
            breaks.filter((b) => b.shiftId === s.id).reduce((sum, b) => sum + (b.endsAt.getTime() - b.startsAt.getTime()), 0) / MINUTE,
          ),
          approvedByUserId: user.id,
          approvedAt: now,
        })),
      )
      .onConflictDoNothing({ target: schema.timeEntry.shiftId })
      .returning({ id: schema.timeEntry.id, shiftId: schema.timeEntry.shiftId });
    if (rows.length) {
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "approve",
        entity: "time_entry",
        data: { asRostered: true, shiftIds: rows.map((r) => r.shiftId) },
      });
    }
    return rows.length;
  });
  revalidatePath("/timesheets");
  return count ? { ok: `${count} shift${count === 1 ? "" : "s"} confirmed as rostered.` } : { error: "Those shifts were already confirmed." };
}

/** Records the hours actually worked when they differ from the rota. */
export async function saveActualHours(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  const breakMinutes = Number(form.get("breakMinutes") ?? 0);
  const awakeMinutes = Number(form.get("awakeMinutes") ?? 0);
  const note = String(form.get("note") ?? "").trim() || null;
  if (!TIME.test(start) || !TIME.test(end)) return { error: "Enter the actual start and finish times." };
  if (!(Number.isInteger(awakeMinutes) && awakeMinutes >= 0)) return { error: "Enter the minutes woken to work as a whole number, or 0." };
  if (!(Number.isInteger(breakMinutes) && breakMinutes >= 0 && breakMinutes <= 240)) return { error: "Enter a break between 0 and 240 minutes." };

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), eq(schema.shift.status, "published")));
    if (!shift?.workerId) return { error: "That shift could not be found." };
    const date = londonParts(shift.startsAt.getTime()).date;
    const startsAt = londonDateTime(date, start);
    // A finish at or before the start means they worked past midnight.
    let endsAt = londonDateTime(date, end);
    if (endsAt <= startsAt) endsAt = londonDateTime(addDays(date, 1), end);
    if (breakMinutes * MINUTE >= endsAt - startsAt) return { error: "The break is longer than the time worked." };
    if (startsAt > Date.now()) return { error: "Hours can only be confirmed once the shift has started." };
    // Only sleep-ins have time woken to work. On other shifts every hour is already paid.
    const awake = shift.kind === "sleep_in" ? awakeMinutes : 0;
    if (awake * MINUTE > endsAt - startsAt) return { error: "The time woken to work is longer than the sleep-in." };

    const values = {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      breakMinutes,
      awakeMinutes: awake,
      note,
      approvedByUserId: user.id,
      approvedAt: new Date(),
    };
    const [row] = await tx
      .insert(schema.timeEntry)
      .values({ organisationId, workerId: shift.workerId, shiftId, ...values })
      .onConflictDoUpdate({ target: schema.timeEntry.shiftId, set: values })
      .returning({ id: schema.timeEntry.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "approve",
      entity: "time_entry",
      entityId: row!.id,
      data: { shiftId, start, end, breakMinutes, awakeMinutes: awake, rostered: { start: shift.startsAt.toISOString(), end: shift.endsAt.toISOString() } },
    });
    return { ok: "Hours saved." };
  });
  revalidatePath("/timesheets");
  return result;
}

export async function undoConfirmation(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("entryId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx.delete(schema.timeEntry).where(eq(schema.timeEntry.id, id)).returning();
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "time_entry",
      entityId: id,
      data: { shiftId: rows[0]!.shiftId, startsAt: rows[0]!.startsAt.toISOString(), endsAt: rows[0]!.endsAt.toISOString() },
    });
  });
  revalidatePath("/timesheets");
}

/** Confirms the hours exactly as clocked: from clock-in to clock-out, less time on breaks. */
export async function confirmClockedHours(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), eq(schema.shift.status, "published")));
    if (!shift?.workerId) return { error: "That shift could not be found." };
    const [clocked] = await clockSummaries(tx, [shift], new Date().getTime());
    const { clockedIn, clockedOut, breakMinutes } = clocked!.summary;
    if (clockedIn === null || clockedOut === null) return { error: "This shift has not been clocked in and out yet." };
    if (breakMinutes * MINUTE >= clockedOut - clockedIn) return { error: "The clocked break is longer than the time worked. Enter the hours by hand." };
    const values = {
      startsAt: new Date(clockedIn),
      endsAt: new Date(clockedOut),
      breakMinutes,
      // Clocking does not record time woken on a sleep-in. The manager adds it with "Change hours".
      awakeMinutes: 0,
      note: "From clock-in",
      approvedByUserId: user.id,
      approvedAt: new Date(),
    };
    const [row] = await tx
      .insert(schema.timeEntry)
      .values({ organisationId, workerId: shift.workerId, shiftId, ...values })
      .onConflictDoUpdate({ target: schema.timeEntry.shiftId, set: values })
      .returning({ id: schema.timeEntry.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "approve",
      entity: "time_entry",
      entityId: row!.id,
      data: { shiftId, source: "clock", clockedIn: values.startsAt.toISOString(), clockedOut: values.endsAt.toISOString(), breakMinutes },
    });
    return { ok: "Clocked hours confirmed." };
  });
  revalidatePath("/timesheets");
  return result;
}

/** Saves what the business's payroll software calls each kind of pay. A blank name uses VicisRota's own. */
export async function setPayItemNames(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const names: Partial<Record<(typeof PAY_ITEMS)[number], string>> = {};
  for (const item of PAY_ITEMS) {
    const name = String(form.get(item) ?? "").trim();
    if (name.length > 60) return { error: "Keep each pay item name under 60 characters." };
    if (name) names[item] = name;
  }
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ payItemNames: names }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "pay_item_names", entityId: organisationId, data: names });
  });
  revalidatePath("/timesheets");
  return { ok: "Saved. The pay items file now uses these names." };
}

/** Care: the flat payment for each sleep-in. Time woken to work is paid by the hour on top. Blank clears it. */
export async function setSleepInPay(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const raw = String(form.get("sleepInPounds") ?? "").trim().replace(/^£/, "");
  if (raw && !/^\d{1,4}(\.\d{1,2})?$/.test(raw)) return { error: "Enter the sleep-in payment in pounds, for example 60 or 62.50." };
  const sleepInPence = raw ? Math.round(Number(raw) * 100) : null;
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ sleepInPence }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "sleep_in_pay", entityId: organisationId, data: { sleepInPence } });
  });
  revalidatePath("/timesheets");
  revalidatePath("/rota");
  return { ok: sleepInPence === null ? "Sleep-in payment cleared." : `Saved. Each sleep-in is paid £${(sleepInPence / 100).toFixed(2)}, plus the hourly rate for time woken to work.` };
}

/**
 * Sends confirmed hours for a pay period to Xero Payroll as draft timesheets, one per person, with a line for each day.
 * People are matched by their payroll ID (the Xero employee ID) or by name. Nothing is approved in Xero.
 */
export async function sendToXero(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const period = parsePeriod(String(form.get("from") ?? ""), String(form.get("to") ?? ""));
  if ("error" in period) return { error: period.error };
  const xero = await xeroClient(organisationId);
  if (!xero) return { error: "Connect Xero first." };
  const { start, end } = periodBounds(period.from, period.to);
  const { workers, entries } = await withOrganisation(db, organisationId, async (tx) => ({
    workers: await tx.select({ id: schema.worker.id, name: schema.worker.fullName, payrollId: schema.worker.payrollId }).from(schema.worker),
    entries: await tx
      .select({ entry: schema.timeEntry, kind: schema.shift.kind })
      .from(schema.timeEntry)
      .leftJoin(schema.shift, eq(schema.timeEntry.shiftId, schema.shift.id))
      .where(and(gte(schema.timeEntry.startsAt, start), lt(schema.timeEntry.startsAt, end))),
  }));
  try {
    const employees: XeroEmployee[] = [];
    for (let page = 1; page <= 20; page++) {
      const batch = (await xero.get<{ employees?: XeroEmployee[] }>(`/Employees?page=${page}`)).employees ?? [];
      employees.push(...batch);
      if (batch.length < 100) break;
    }
    const rates = (await xero.get<{ earningsRates?: XeroEarningsRate[] }>("/EarningsRates")).earningsRates ?? [];
    const ordinary = rates.find((r) => r.earningsType === "OrdinaryEarnings" && r.currentRecord !== false);
    if (!ordinary) return { error: "Xero has no earnings rate for ordinary hours. Add one in Xero Payroll settings, then try again." };
    const withHours = workers.filter((w) => entries.some((e) => e.entry.workerId === w.id));
    const matched = matchEmployees(
      withHours,
      employees.map((e) => ({ ...e, id: e.employeeID, name: `${e.firstName} ${e.lastName}` })),
    );
    const sent: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const w of withHours) {
      const employee = matched.get(w.id);
      if (!employee?.payrollCalendarID) {
        skipped.push(w.name);
        continue;
      }
      const days = dailyHours(
        entries
          .filter((e) => e.entry.workerId === w.id)
          .map((e) => ({
            start: e.entry.startsAt.toISOString(),
            end: e.entry.endsAt.toISOString(),
            breakMinutes: e.entry.breakMinutes,
            sleepIn: e.kind === "sleep_in",
            awakeMinutes: e.entry.awakeMinutes,
          })),
      );
      if (!days.length) continue;
      try {
        await xero.post("/Timesheets", {
          payrollCalendarID: employee.payrollCalendarID,
          employeeID: employee.employeeID,
          startDate: period.from,
          endDate: period.to,
          timesheetLines: days.map((d) => ({ date: d.date, earningsRateID: ordinary.earningsRateID, numberOfUnits: d.hours })),
        });
        sent.push(w.name);
      } catch (e) {
        failed.push(`${w.name}: ${e instanceof Error ? e.message : "Xero refused it"}`);
      }
    }
    await withOrganisation(db, organisationId, async (tx) => {
      await tx.update(schema.xeroConnection).set({ lastSentAt: new Date() }).where(eq(schema.xeroConnection.id, xero.connectionId));
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "export",
        entity: "xero_timesheets",
        entityId: `${period.from}..${period.to}`,
        data: { sent: sent.length, skipped: skipped.length, failed: failed.length },
      });
    });
    const parts = [
      sent.length ? `Sent draft timesheets to ${xero.tenantName} for ${sent.join(", ")}. Check and approve them in Xero.` : "No timesheets were sent.",
      skipped.length ? `Not matched to anyone in Xero: ${skipped.join(", ")}. Put their Xero employee ID in Payroll ID on their staff record, or make the names match.` : "",
      failed.length ? `Xero did not accept: ${failed.join(" ")} Check the dates match a pay period in Xero.` : "",
    ].filter(Boolean);
    return failed.length || !sent.length ? { error: parts.join(" ") } : { ok: parts.join(" ") };
  } catch (e) {
    return { error: `Could not reach Xero: ${e instanceof Error ? e.message : "unknown problem"}. Try again, or connect Xero again.` };
  }
}

/** Disconnects Xero. The connection can be made again at any time. */
export async function disconnectXero() {
  const { user, organisationId } = await requireManager();
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.delete(schema.xeroConnection);
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "delete", entity: "xero_connection", entityId: organisationId });
  });
  revalidatePath("/timesheets");
}
