import { schema, withOrganisation } from "@vicisrota/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { completeConnection } from "@/lib/xero";

/** Xero sends the manager back here. The state must match the one set when they left, for the same business. */
export async function GET(request: Request) {
  const { user, organisationId } = await requireManager();
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("vr_xero_state")?.value;
  jar.delete({ name: "vr_xero_state", path: "/api/xero" });
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected || !expected.startsWith(`${organisationId}.`)) redirect("/timesheets?xero=failed");
  let ok = false;
  try {
    const name = await completeConnection(organisationId, user.id, code);
    await withOrganisation(db, organisationId, async (tx) =>
      tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "xero_connection", entityId: name }),
    );
    ok = true;
  } catch (e) {
    await log("warn", "xero connect failed", { organisationId, error: e instanceof Error ? e.message : String(e) });
  }
  redirect(`/timesheets?xero=${ok ? "connected" : "failed"}`);
}
