import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { authoriseUrl, xeroConfigured } from "@/lib/xero";

const STATE_COOKIE = "vr_xero_state";

/** Sends the manager to Xero to choose their organisation and allow VicisRota to send timesheets. */
export async function GET() {
  const { organisationId } = await requireManager();
  if (!xeroConfigured()) redirect("/timesheets?xero=not-set-up");
  const state = `${organisationId}.${randomBytes(16).toString("base64url")}`;
  (await cookies()).set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/xero", maxAge: 600 });
  redirect(authoriseUrl(state));
}
