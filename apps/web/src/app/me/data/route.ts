import { schema, withOrganisation } from "@vicisrota/db";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { dataFileName, workerData } from "@/lib/retention";

/** A copy of everything held about the signed-in person, as a file they can keep or take elsewhere. */
export async function GET() {
  const { user, organisationId, worker } = await requireStaff();
  const data = await workerData(organisationId, worker.id);
  await withOrganisation(db, organisationId, async (tx) =>
    tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "export", entity: "worker_data", entityId: worker.id }),
  );
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataFileName(worker.fullName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
