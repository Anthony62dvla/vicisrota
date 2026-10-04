"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DISPLAY_COOKIE, serialiseDisplay } from "@/lib/display";

/** Saves the choices on this device for a year. Only pages on this site are allowed as the return address. */
export async function saveDisplay(form: FormData) {
  const value = serialiseDisplay(form.getAll("display").map(String));
  const jar = await cookies();
  if (value) jar.set(DISPLAY_COOKIE, value, { maxAge: 365 * 24 * 3600, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  else jar.delete(DISPLAY_COOKIE);
  const back = String(form.get("back") ?? "");
  redirect(`/display?saved=1${back.startsWith("/") && !back.startsWith("//") ? `&back=${encodeURIComponent(back)}` : ""}`);
}
