import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { authenticate, json, period } from "@/lib/api";
import { db } from "@/lib/db";

/** Approved time off overlapping the period. Sickness shows only as "sick", never the reason. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const p = period(request);
  if (p instanceof Response) return p;
  const rows = await withOrganisation(db, auth.organisationId, (tx) =>
    tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.status, "approved"), lte(schema.leaveRequest.startsOn, p.to), gte(schema.leaveRequest.endsOn, p.from))),
  );
  return json(rows.map((l) => ({ id: l.id, staffId: l.workerId, kind: l.kind, startsOn: l.startsOn, endsOn: l.endsOn })));
}
