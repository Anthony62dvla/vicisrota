import { STATEMENT_DEFAULTS, type StatementPerson, type StatementTerms } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { desc, eq, inArray } from "drizzle-orm";

export const TERM_FIELDS: { key: Exclude<keyof StatementTerms, "payInterval">; label: string }[] = [
  { key: "bankHolidays", label: "Bank holidays" },
  { key: "sickPay", label: "Sick pay" },
  { key: "otherPaidLeave", label: "Other paid leave" },
  { key: "benefits", label: "Other benefits" },
  { key: "probation", label: "Probation" },
  { key: "training", label: "Training" },
  { key: "noticeFromEmployer", label: "Notice you give" },
  { key: "noticeFromWorker", label: "Notice they give" },
  { key: "pension", label: "Pension" },
  { key: "disciplinaryAndGrievance", label: "Disciplinary and grievance procedures" },
  { key: "collectiveAgreements", label: "Collective agreements" },
];

export const termsOf = (raw: Partial<Record<string, string>>): StatementTerms => raw as StatementTerms;
export const termDefault = (key: keyof StatementTerms) => STATEMENT_DEFAULTS[key];

/** What VicisRota already knows about a person, to start their statement. Runs inside withOrganisation. */
export const statementPersonFor = async (tx: Transaction, organisationId: string, workerId: string): Promise<(StatementPerson & { terms: StatementTerms }) | null> => {
  const [[org], [worker], rates, held, locations] = await Promise.all([
    tx.select().from(schema.organisation).where(eq(schema.organisation.id, organisationId)),
    tx.select().from(schema.worker).where(eq(schema.worker.id, workerId)),
    tx.select().from(schema.payRate).where(eq(schema.payRate.workerId, workerId)).orderBy(desc(schema.payRate.effectiveFrom)),
    tx.select({ roleId: schema.workerRole.roleId }).from(schema.workerRole).where(eq(schema.workerRole.workerId, workerId)),
    tx.select().from(schema.location),
  ]);
  if (!org || !worker) return null;
  const roles = held.length ? await tx.select({ name: schema.jobRole.name }).from(schema.jobRole).where(inArray(schema.jobRole.id, held.map((h) => h.roleId))) : [];
  return {
    employerName: org.name,
    workerName: worker.fullName,
    jobTitle: roles.map((r) => r.name).join(" and "),
    startDate: worker.employmentStart,
    hours: worker.irregularHours ? "Your hours vary from week to week. Your shifts are set on the published rota." : "",
    placeOfWork: locations.length ? locations.map((l) => (l.address ? `${l.name}, ${l.address}` : l.name)).join("; ") : org.name,
    hourlyPence: rates[0]?.hourlyPence ?? null,
    irregularHours: worker.irregularHours,
    daysPerWeek: worker.daysPerWeek,
    leaveYearStartMonth: org.leaveYearStartMonth,
    terms: termsOf(org.statementTerms),
  };
};
