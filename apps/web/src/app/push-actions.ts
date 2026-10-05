"use server";

import { schema } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { sendPush } from "@/lib/push";

/** The browsers' own push services. Anything else is refused, so the server never posts to an address someone made up. */
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
const KEY = /^[A-Za-z0-9_-]{16,200}$/;

/** Remembers this device so app notifications reach it. Called from the browser after the person allows notifications. */
export async function savePushDevice(device: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
  const { user, organisationId } = await requireMember();
  const { endpoint, keys } = device ?? {};
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !PUSH_HOST.test(endpoint) || !KEY.test(keys?.p256dh ?? "") || !KEY.test(keys?.auth ?? "")) return { ok: false };
  await db
    .insert(schema.pushSubscription)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: schema.pushSubscription.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth } });
  await log("info", "app notifications turned on", { organisationId });
  return { ok: true };
}

/** Forgets this device: no more app notifications on it. */
export async function removePushDevice(endpoint: string): Promise<{ ok: boolean }> {
  const { user } = await requireMember();
  if (typeof endpoint !== "string") return { ok: false };
  await db.delete(schema.pushSubscription).where(and(eq(schema.pushSubscription.endpoint, endpoint), eq(schema.pushSubscription.userId, user.id)));
  return { ok: true };
}

/** Sends a test notification to the person's own devices. */
export async function sendTestNotification(): Promise<{ sent: number }> {
  const { user, businessName } = await requireMember();
  const sent = await sendPush([user.id], { title: businessName, body: "Notifications are working. This is how rota changes and reminders will look.", url: "/me", tag: "test" });
  return { sent };
}
