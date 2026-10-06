"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { hashKioskToken, KIOSK_COOKIE, newKioskToken } from "@/lib/kiosk";
import { requestId } from "@/lib/request";

export type FormState = { error?: string; ok?: string };

const RADII = [50, 100, 150, 250, 500];

/** "53.4808, -2.2426", or a Google Maps link containing "@53.4808,-2.2426" or "q=53.4808,-2.2426". */
const parseCoordinates = (text: string) => {
  const m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(text);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  // Roughly the UK and Ireland, to catch latitude and longitude typed the wrong way round.
  if (latitude < 49 || latitude > 61 || longitude < -11 || longitude > 2.5) return null;
  return { latitude, longitude };
};

export async function addWorkplace(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim();
  const address = String(form.get("address") ?? "").trim() || null;
  const where = String(form.get("coordinates") ?? "").trim();
  const radiusMetres = Number(form.get("radius") ?? 150);
  if (!name) return { error: "Enter a name for the workplace, for example Main shop." };
  if (!RADII.includes(radiusMetres)) return { error: "Choose how close counts as at work." };
  const coords = where ? parseCoordinates(where) : null;
  if (where && !coords) return { error: "That location was not recognised. Use the button while you are there, or paste a map link." };
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.insert(schema.location).values({ organisationId, name, address, radiusMetres, ...coords }).returning({ id: schema.location.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "location", entityId: row!.id, data: { name, mapped: !!coords, radiusMetres } });
  });
  revalidatePath("/workplaces");
  return { ok: `${name} added.${coords ? "" : " Add its location to use location checks."}` };
}

export async function setLocationRule(form: FormData) {
  const { user, organisationId } = await requireManager();
  const rule = String(form.get("rule") ?? "");
  if (rule !== "off" && rule !== "record" && rule !== "require") return;
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ clockLocationRule: rule }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "clock_location_rule", entityId: organisationId, data: { rule } });
  });
  revalidatePath("/workplaces");
}

/**
 * Turns this browser into the clock-in tablet for a workplace, then signs the manager out of it,
 * so the tablet left on the counter cannot open the rest of the app.
 */
export async function setUpKiosk(form: FormData) {
  const { user, organisationId } = await requireManager();
  const locationId = String(form.get("locationId") ?? "");
  const token = newKioskToken();
  const ok = await withOrganisation(db, organisationId, async (tx) => {
    const [place] = await tx.select({ id: schema.location.id }).from(schema.location).where(and(eq(schema.location.id, locationId), eq(schema.location.organisationId, organisationId)));
    if (!place) return false;
    const [device] = await tx
      .insert(schema.kioskDevice)
      .values({ organisationId, locationId, tokenHash: hashKioskToken(token), createdByUserId: user.id })
      .returning({ id: schema.kioskDevice.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "kiosk_device", entityId: device!.id, data: { locationId } });
    return true;
  });
  if (!ok) return;
  (await cookies()).set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  await auth.api.signOut({ headers: await headers() });
  redirect("/kiosk");
}

export async function revokeKiosk(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    await tx
      .update(schema.kioskDevice)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.kioskDevice.id, id), eq(schema.kioskDevice.organisationId, organisationId)));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "revoke", entity: "kiosk_device", entityId: id });
  });
  revalidatePath("/workplaces");
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Which places sell alcohol, and their licensed hours. "org" stands for shifts with no workplace set. */
export async function saveLicensing(form: FormData) {
  const { user, organisationId } = await requireManager();
  const read = (key: string) => {
    if (form.get(`sells-${key}`) !== "on") return null;
    const from = String(form.get(`from-${key}`) ?? "");
    const to = String(form.get(`to-${key}`) ?? "");
    // Hours only count when both are given and differ; otherwise the whole time staff are working is checked.
    return HHMM.test(from) && HHMM.test(to) && from !== to ? { from, to } : {};
  };
  await withOrganisation(db, organisationId, async (tx) => {
    const places = await tx.select({ id: schema.location.id }).from(schema.location);
    await tx.update(schema.organisation).set({ licensing: read("org") }).where(eq(schema.organisation.id, organisationId));
    for (const p of places) await tx.update(schema.location).set({ licensing: read(p.id) }).where(eq(schema.location.id, p.id));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "licensing", entityId: organisationId });
  });
  revalidatePath("/workplaces");
  revalidatePath("/rota");
}
