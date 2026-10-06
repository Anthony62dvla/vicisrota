import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { appUrl } from "./sms";

/**
 * Xero Payroll (UK) connection. Set XERO_CLIENT_ID and XERO_CLIENT_SECRET in app.env from an app made at
 * developer.xero.com, with the redirect URI https://www.vicisrota.app/api/xero/callback.
 */
export const xeroConfigured = () => !!process.env.XERO_CLIENT_ID && !!process.env.XERO_CLIENT_SECRET;

const SCOPES = "offline_access payroll.employees payroll.timesheets payroll.settings";
// Can be pointed at a stand-in server for testing.
const PAYROLL = process.env.XERO_PAYROLL_URL ?? "https://api.xero.com/payroll.xro/2.0";
export const redirectUri = () => appUrl("/api/xero/callback");

export const authoriseUrl = (state: string) =>
  `https://login.xero.com/identity/connect/authorize?${new URLSearchParams({ response_type: "code", client_id: process.env.XERO_CLIENT_ID!, redirect_uri: redirectUri(), scope: SCOPES, state })}`;

type Tokens = { access_token: string; refresh_token: string; expires_at: number };

// Tokens are encrypted with a key made from the app's own secret, so a database copy alone cannot use them.
const key = () => createHash("sha256").update(`vicisrota-xero:${process.env.BETTER_AUTH_SECRET ?? ""}`).digest();
export const sealTokens = (t: Tokens) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(t), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
};
const open = (s: string): Tokens => {
  const [iv, tag, body] = s.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv!);
  d.setAuthTag(tag!);
  return JSON.parse(Buffer.concat([d.update(body!), d.final()]).toString("utf8"));
};

const tokenRequest = async (body: Record<string, string>): Promise<Tokens> => {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Xero sign-in failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 };
};

/** Finishes connecting: swaps the code for tokens and remembers the Xero organisation. */
export const completeConnection = async (organisationId: string, userId: string, code: string) => {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const res = await fetch("https://api.xero.com/connections", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const tenants = (await res.json()) as { tenantId: string; tenantName: string; tenantType: string }[];
  const tenant = tenants.find((t) => t.tenantType === "ORGANISATION");
  if (!tenant) throw new Error("No Xero organisation was chosen");
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.delete(schema.xeroConnection);
    await tx.insert(schema.xeroConnection).values({ organisationId, tenantId: tenant.tenantId, tenantName: tenant.tenantName, tokens: sealTokens(tokens), connectedByUserId: userId });
  });
  return tenant.tenantName;
};

/** A signed-in client for one business's Xero payroll, refreshing the access token when it runs out. */
export const xeroClient = async (organisationId: string) => {
  const [conn] = await withOrganisation(db, organisationId, (tx) => tx.select().from(schema.xeroConnection));
  if (!conn) return null;
  let tokens = open(conn.tokens);
  if (Date.now() > tokens.expires_at) {
    tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    await withOrganisation(db, organisationId, (tx) => tx.update(schema.xeroConnection).set({ tokens: sealTokens(tokens) }).where(eq(schema.xeroConnection.id, conn.id)));
  }
  const call = async <T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${PAYROLL}${path}`, {
      method,
      headers: { authorization: `Bearer ${tokens.access_token}`, "xero-tenant-id": conn.tenantId, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      // Xero explains validation problems in "problem.detail" or "invalidFields"; pass the words on to the manager.
      let detail = text.slice(0, 300);
      try {
        type Problem = { detail?: string; title?: string; invalidFields?: { reason?: string }[] };
        const parsed = JSON.parse(text) as Problem & { problem?: Problem };
        const j = parsed.problem ?? parsed;
        detail = j.invalidFields?.map((f) => f.reason).filter(Boolean).join(" ") || j.detail || j.title || detail;
      } catch {}
      throw new Error(detail || `Xero said no (${res.status})`);
    }
    return JSON.parse(text) as T;
  };
  return { tenantName: conn.tenantName, connectionId: conn.id, get: <T>(path: string) => call<T>("GET", path), post: <T>(path: string, body: unknown) => call<T>("POST", path, body) };
};

export type XeroEmployee = { employeeID: string; firstName: string; lastName: string; payrollCalendarID?: string | null; endDate?: string | null };
export type XeroEarningsRate = { earningsRateID: string; name: string; earningsType: string; currentRecord?: boolean };
