import { schema, withOrganisation } from "@vicisrota/db";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { dataFileName, workerData } from "@/lib/retention";

const UUID = /^[0-9a-f-]{36}$/i;

/** Everything held about one person, for answering a subject access request. Every download is recorded. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const { user, organisationId } = await requireManager();
  const data = await workerData(organisationId, id);
  if (!data) return new Response("Not found", { status: 404 });
  await withOrganisation(db, organisationId, async (tx) =>
    tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "export", entity: "worker_data", entityId: id }),
  );
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataFileName(data.you.fullName ?? "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
