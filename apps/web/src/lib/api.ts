import { createHash, randomBytes } from "node:crypto";
import { schema } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";

export const API_KEY_PREFIX = "vr_live_";
export const newApiKey = () => `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** The longest period one request can ask for, so a single call cannot pull years of records. */
export const MAX_DAYS = 93;

export const apiError = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}) } });

/** The business a request's API key belongs to, or an error response. Keys are read-only. */
export const authenticate = async (request: Request): Promise<{ organisationId: string } | Response> => {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(API_KEY_PREFIX)) return apiError(401, "Send your API key as: Authorization: Bearer vr_live_...");
  const [row] = await db
    .select({ id: schema.apiKey.id, organisationId: schema.apiKey.organisationId, lastUsedAt: schema.apiKey.lastUsedAt })
    .from(schema.apiKey)
    .where(and(eq(schema.apiKey.keyHash, hashApiKey(key)), isNull(schema.apiKey.revokedAt)));
  if (!row) return apiError(401, "That API key is not valid, or has been revoked.");
  // Recorded at most every few minutes, so busy integrations do not write on every call.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60_000)
    await db.update(schema.apiKey).set({ lastUsedAt: new Date() }).where(eq(schema.apiKey.id, row.id));
  return { organisationId: row.organisationId };
};

/** Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD (to inclusive), or an error response. */
export const period = (request: Request): { from: string; to: string } | Response => {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return apiError(400, "Give from and to as dates, for example ?from=2026-10-12&to=2026-10-18.");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days < 0) return apiError(400, "from must be on or before to.");
  if (days > MAX_DAYS) return apiError(400, `Ask for at most ${MAX_DAYS} days at a time.`);
  return { from, to };
};

export const json = (data: unknown) => Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
