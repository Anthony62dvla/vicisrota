import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, lt, ne } from "drizzle-orm";
import { db } from "./db";
import { sendPush } from "./push";

/** Applications are deleted this long after they were made, unless the person was hired. */
export const KEEP_APPLICATIONS_DAYS = 180;

export const STATUS_LABEL = {
  new: "New",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offered: "Offered",
  hired: "Hired",
  not_progressed: "Not taken forward",
} as const;
export type ApplicantStatus = keyof typeof STATUS_LABEL;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The public address of a job advert. */
export const jobPath = (organisationId: string, postId: string) => `/jobs/${organisationId}/${postId}`;

/** Tells the business's managers there is a new application. Only the job title, never the applicant's details. */
export const tellManagersAboutApplicant = async (organisationId: string, title: string) => {
  const managers = await withOrganisation(db, organisationId, (tx) =>
    tx
      .select({ userId: schema.membership.userId })
      .from(schema.membership)
      .where(and(eq(schema.membership.organisationId, organisationId), ne(schema.membership.role, "worker"))),
  );
  await sendPush(managers.map((m) => m.userId), { title: "New application", body: `Someone applied for ${title}.`, url: "/hiring", tag: `applicant:${title}` });
};

/** Deletes applications older than KEEP_APPLICATIONS_DAYS, except for people who were hired. Returns how many. */
export const deleteOldApplications = async (organisationId: string, now: number) =>
  (
    await withOrganisation(db, organisationId, (tx) =>
      tx
        .delete(schema.applicant)
        .where(and(lt(schema.applicant.createdAt, new Date(now - KEEP_APPLICATIONS_DAYS * 86_400_000)), ne(schema.applicant.status, "hired")))
        .returning({ id: schema.applicant.id }),
    )
  ).length;
