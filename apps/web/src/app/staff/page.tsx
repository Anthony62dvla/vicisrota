import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { AddWorkerForm } from "./add-worker-form";

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export default async function StaffPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { everyone, rates, rtw } = await withOrganisation(db, organisationId, async (tx) => ({
    everyone: await tx.select().from(schema.worker).orderBy(asc(schema.worker.fullName)),
    rates: await tx.select().from(schema.payRate).orderBy(desc(schema.payRate.effectiveFrom)),
    rtw: await tx.select().from(schema.workerCheck).where(eq(schema.workerCheck.kind, "right_to_work")),
  }));
  const workers = everyone.filter((w) => !w.leftOn);
  const leavers = everyone.filter((w) => w.leftOn).sort((a, b) => b.leftOn!.localeCompare(a.leftOn!));
  const hasRightToWork = (workerId: string) =>
    rtw.some((c) => c.workerId === workerId && c.checkedOn <= today && (!c.expiresOn || c.expiresOn >= today));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <Link href="/staff/import" className="rounded-lg border border-zinc-400 px-3 py-1.5 font-medium hover:bg-brand-soft">
          Add people from a spreadsheet
        </Link>
      </div>
      {workers.length === 0 ? (
        <p className="mt-4">No staff yet. Add your first person below.</p>
      ) : (
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2">Name</th>
              <th className="py-2">Date of birth</th>
              <th className="py-2">Hourly rate</th>
              <th className="py-2">Works over 48 hours</th>
              <th className="py-2">Right to work</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => {
              const rate = rates.find((r) => r.workerId === w.id);
              return (
                <tr key={w.id} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2">
                    <Link href={`/staff/${w.id}`} className="underline">{w.fullName}</Link>
                  </td>
                  <td className="py-2">{w.dateOfBirth}</td>
                  <td className="py-2">{rate ? pounds(rate.hourlyPence) : "Not set"}</td>
                  <td className="py-2">{w.optedOutOf48HourLimit ? "Yes" : "No"}</td>
                  <td className="py-2">{hasRightToWork(w.id) ? "Checked" : <strong>Needs a check</strong>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {leavers.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer font-medium">People who have left ({leavers.length})</summary>
          <p className="mt-2 text-sm text-muted">Their records are kept for payroll and working-time checks. They are not put on rotas or counted in your price.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {leavers.map((w) => (
              <li key={w.id}>
                <Link href={`/staff/${w.id}`} className="underline">{w.fullName}</Link>
                <span className="text-muted">, last day {w.leftOn}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <AddWorkerForm />
    </main>
  );
}
