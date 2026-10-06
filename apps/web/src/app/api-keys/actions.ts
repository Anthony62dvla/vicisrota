"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashApiKey, newApiKey } from "@/lib/api";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

export type KeyState = { error?: string; key?: string; name?: string };

/** Makes a new read-only key. The key itself is returned once and never stored. */
export async function createApiKey(_: KeyState, form: FormData): Promise<KeyState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the key a name, such as the software that will use it." };
  const key = newApiKey();
  await db.insert(schema.apiKey).values({ organisationId, name, prefix: key.slice(0, 12), keyHash: hashApiKey(key), createdByUserId: user.id });
  await withOrganisation(db, organisationId, async (tx) =>
    tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "api_key", entityId: name }),
  );
  revalidatePath("/api-keys");
  return { key, name };
}

export async function revokeApiKey(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  // api_key has no row-level security, so the business is checked here.
  await db.update(schema.apiKey).set({ revokedAt: new Date() }).where(and(eq(schema.apiKey.id, id), eq(schema.apiKey.organisationId, organisationId)));
  await withOrganisation(db, organisationId, async (tx) =>
    tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "revoke", entity: "api_key", entityId: id }),
  );
  revalidatePath("/api-keys");
}
