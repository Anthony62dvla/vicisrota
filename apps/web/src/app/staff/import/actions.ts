"use server";

import { checkStaffImport, type ImportCheck } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { normaliseUkMobile } from "@vicisrota/messaging";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { addingBlocked } from "@/lib/plan";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

/** Big enough for a few thousand rows; anything larger is not a staff list. */
const MAX_BYTES = 1_000_000;

export type ImportState = {
  error?: string;
  /** The result of checking the file, shown before anything is saved. */
  check?: Omit<ImportCheck, "people"> & { people: { line: number; fullName: string; hourlyPence: number; roles: string[] }[] };
  /** The file's text, sent back with "Add these people" so the same rows are saved. */
  csv?: string;
  done?: string;
};

const check = async (organisationId: string, csv: string) => {
  const { existing, roles } = await withOrganisation(db, organisationId, async (tx) => ({
    existing: await tx.select({ fullName: schema.worker.fullName, dateOfBirth: schema.worker.dateOfBirth }).from(schema.worker),
    roles: await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
  }));
  return { result: checkStaffImport(csv, { today: todayInUk(), existing, roles: roles.map((r) => r.name), normaliseMobile: normaliseUkMobile }), roles };
};

/**
 * Step one reads the uploaded file and shows what would happen, saving nothing. Step two, after the
 * manager says yes, checks the same text again and adds the people who are ready, all in one go.
 */
export async function importStaff(_: ImportState, form: FormData): Promise<ImportState> {
  const { user, organisationId } = await requireManager();

  if (form.get("confirm") === "yes") {
    const csv = String(form.get("csv") ?? "");
    const { result, roles } = await check(organisationId, csv);
    if (result.fileError || !result.people.length) return { error: result.fileError ?? "There is nobody new to add." };
    const full = await addingBlocked(organisationId, result.people.length);
    if (full) return { error: full };
    const roleId = new Map(roles.map((r) => [r.name, r.id]));
    await withOrganisation(db, organisationId, async (tx) => {
      for (const p of result.people) {
        const [worker] = await tx
          .insert(schema.worker)
          .values({
            organisationId,
            fullName: p.fullName,
            dateOfBirth: p.dateOfBirth,
            employmentStart: p.employmentStart,
            daysPerWeek: p.daysPerWeek,
            irregularHours: p.irregularHours,
            mobile: p.mobile,
            payrollId: p.payrollId,
          })
          .returning({ id: schema.worker.id });
        await tx.insert(schema.payRate).values({ organisationId, workerId: worker!.id, hourlyPence: p.hourlyPence, effectiveFrom: p.rateFrom });
        if (p.roles.length) await tx.insert(schema.workerRole).values(p.roles.map((r) => ({ organisationId, workerId: worker!.id, roleId: roleId.get(r)! })));
      }
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "import",
        entity: "worker",
        // Counts only: the names are in the staff list itself.
        data: { added: result.people.length, skipped: result.problems.length, duplicates: result.duplicates.length },
      });
    });
    revalidatePath("/staff");
    const n = result.people.length;
    return { done: `${n} ${n === 1 ? "person has" : "people have"} been added. Next, check their right to work and invite them to the app from each person's page.` };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to upload." };
  if (file.size > MAX_BYTES) return { error: "That file is too big for a staff list. Save it as CSV and try again." };
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return { error: "Save the spreadsheet as CSV first (File, Save as or Download, then CSV), and upload that." };
  const csv = await file.text();
  const { result } = await check(organisationId, csv);
  if (result.fileError) return { error: result.fileError };
  return {
    csv,
    check: { ...result, people: result.people.map((p) => ({ line: p.line, fullName: p.fullName, hourlyPence: p.hourlyPence, roles: p.roles })) },
  };
}
