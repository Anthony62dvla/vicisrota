"use server";

import { schema } from "@vicisrota/db";
import { isLang } from "@vicisrota/messaging";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DISPLAY_COOKIE, serialiseDisplay } from "@/lib/display";
import { LANG_COOKIE } from "@/lib/i18n/server";

/** Saves the choices on this device for a year. Only pages on this site are allowed as the return address. */
export async function saveDisplay(form: FormData) {
  const value = serialiseDisplay(form.getAll("display").map(String));
  const jar = await cookies();
  if (value) jar.set(DISPLAY_COOKIE, value, { maxAge: 365 * 24 * 3600, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  else jar.delete(DISPLAY_COOKIE);
  const back = String(form.get("back") ?? "");
  redirect(`/display?saved=1${back.startsWith("/") && !back.startsWith("//") ? `&back=${encodeURIComponent(back)}` : ""}`);
}

/**
 * Saves the person's language: on their account, so it follows them to every device and their app
 * notifications use it, and on this device for pages seen before signing in.
 */
export async function saveLanguage(form: FormData) {
  const value = String(form.get("language") ?? "");
  if (!isLang(value)) redirect("/display");
  (await cookies()).set(LANG_COOKIE, value, { maxAge: 365 * 24 * 3600, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) await db.update(schema.user).set({ language: value === "en" ? null : value }).where(eq(schema.user.id, session.user.id));
  const back = String(form.get("back") ?? "");
  redirect(`/display?saved=language${back.startsWith("/") && !back.startsWith("//") ? `&back=${encodeURIComponent(back)}` : ""}`);
}
