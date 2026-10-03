import { setupSteps, type SetupStep } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";

const { worker, workerCheck, invitation, client, location, shift, alertContact, organisation } = schema;
const count = (query: ReturnType<typeof sql>) => sql<number>`(${query})::int`;
/** People with a check of this kind recorded. */
const checked = (kind: "right_to_work" | "dbs") => sql`exists (select 1 from ${workerCheck} c where c.worker_id = w.id and c.kind = ${kind})`;
/** The first person added who is still missing something, so the step can link straight to them. */
const firstWithout = (has: ReturnType<typeof sql>) =>
  sql<string | null>`(select w.id from ${worker} w where not ${has} order by w.created_at, w.id limit 1)`;

/**
 * Works out the guided setup steps for a business from what it has recorded so far.
 * Runs as one query; tenant tables are limited by row-level security, and the two tables
 * without it (organisation and invitation) are filtered by business here.
 */
export const loadSetupSteps = (organisationId: string): Promise<SetupStep[]> =>
  withOrganisation(db, organisationId, async (tx) => {
    const now = new Date().toISOString();
    // Can sign in already, or has an invitation that is still open.
    const invited = sql`(w.user_id is not null or exists (
      select 1 from ${invitation} i where i.worker_id = w.id and i.organisation_id = ${organisationId}
        and i.accepted_at is null and i.revoked_at is null and i.expires_at > ${now}::timestamptz))`;
    const [facts] = await tx
      .select({
        sector: organisation.sector,
        requiresEnhancedDbs: organisation.requiresEnhancedDbs,
        hasTippingPolicy: sql<boolean>`coalesce(trim(${organisation.tippingPolicy}), '') <> ''`,
        staff: count(sql`select count(*) from ${worker}`),
        withRightToWork: count(sql`select count(*) from ${worker} w where ${checked("right_to_work")}`),
        withDbs: count(sql`select count(*) from ${worker} w where ${checked("dbs")}`),
        invitedOrJoined: count(sql`select count(*) from ${worker} w where ${invited}`),
        nextRightToWork: firstWithout(checked("right_to_work")),
        nextDbs: firstWithout(checked("dbs")),
        nextInvite: firstWithout(invited),
        clients: count(sql`select count(*) from ${client}`),
        workplaces: count(sql`select count(*) from ${location}`),
        shifts: count(sql`select count(*) from ${shift} where ${shift.status} <> 'cancelled'`),
        publishedShifts: count(sql`select count(*) from ${shift} where ${shift.publishedAt} is not null`),
        alertContacts: count(sql`select count(*) from ${alertContact}`),
      })
      .from(organisation)
      .where(eq(organisation.id, organisationId));
    const { nextRightToWork, nextDbs, nextInvite, ...rest } = facts!;
    const nextPerson = { right_to_work: nextRightToWork ?? undefined, dbs: nextDbs ?? undefined, invite: nextInvite ?? undefined };
    return setupSteps({ ...rest, nextPerson });
  });
