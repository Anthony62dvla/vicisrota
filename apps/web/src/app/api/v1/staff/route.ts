import { schema, withOrganisation } from "@vicisrota/db";
import { authenticate, json } from "@/lib/api";
import { db } from "@/lib/db";

/** Everyone on the team. Only work details: no date of birth, contact details, checks or anything about health. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const { workers, roles, held } = await withOrganisation(db, auth.organisationId, async (tx) => ({
    workers: await tx.select().from(schema.worker).orderBy(schema.worker.fullName),
    roles: await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
    held: await tx.select().from(schema.workerRole),
  }));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  return json(
    workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      payrollId: w.payrollId,
      employmentStart: w.employmentStart,
      leftOn: w.leftOn,
      roles: held.filter((h) => h.workerId === w.id).map((h) => roleName.get(h.roleId) ?? null).filter(Boolean),
    })),
  );
}
