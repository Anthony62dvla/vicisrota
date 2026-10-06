import { addDays } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gt, isNotNull, lt, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk, weekBounds } from "@/lib/rota";
import { shiftWhen } from "@/lib/swaps";
import { SwapForm } from "./swap-form";

const WEEKS_AHEAD = 4;

/** Choose a colleague's shift to swap one of yours with. */
export default async function SwapPage({ params }: PageProps<"/me/swap/[shiftId]">) {
  const { organisationId, worker } = await requireStaff();
  const { shiftId } = await params;
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const now = new Date();
    const [mine] = await tx
      .select()
      .from(schema.shift)
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id), eq(schema.shift.status, "published"), gt(schema.shift.startsAt, now)));
    if (!mine) return null;
    const { to } = weekBounds(addDays(todayInUk(), 7 * WEEKS_AHEAD));
    const [shifts, workers, roles, workerRoles] = await Promise.all([
      tx
        .select()
        .from(schema.shift)
        .where(and(eq(schema.shift.status, "published"), isNotNull(schema.shift.workerId), ne(schema.shift.workerId, worker.id), gt(schema.shift.startsAt, now), lt(schema.shift.startsAt, to)))
        .orderBy(asc(schema.shift.startsAt)),
      tx.select({ id: schema.worker.id, fullName: schema.worker.fullName }).from(schema.worker),
      tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
      tx.select().from(schema.workerRole),
    ]);
    const holds = (workerId: string, roleId: string | null) => !roleId || workerRoles.some((r) => r.workerId === workerId && r.roleId === roleId);
    const name = new Map(workers.map((w) => [w.id, w.fullName]));
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    // Only swaps that work for job roles both ways. The legal checks run when you ask.
    const options = shifts
      .filter((s) => holds(worker.id, s.roleId) && holds(s.workerId!, mine.roleId))
      .map((s) => ({
        id: s.id,
        label: `${shiftWhen(s)} · ${name.get(s.workerId!) ?? "A colleague"}${s.roleId && roleName.has(s.roleId) ? ` · ${roleName.get(s.roleId)}` : ""}`,
      }));
    return { mine, options, myRole: mine.roleId ? roleName.get(mine.roleId) : undefined };
  });
  if (!data) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <p>
        <Link href="/me" className="underline">Back to your shifts</Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Swap a shift with a colleague</h1>
      <p className="mt-2">
        You are offering your shift on <strong>{shiftWhen(data.mine)}</strong>
        {data.myRole ? ` (${data.myRole})` : ""}. Choose the shift you would like in return.
      </p>
      <ol className="mt-3 list-decimal pl-6 text-sm">
        <li>VicisRota checks the swap is legal for both of you.</li>
        <li>Your colleague says yes or no.</li>
        <li>Your manager approves it. You both keep your own shifts until then.</li>
      </ol>
      {data.options.length === 0 ? (
        <p className="mt-6">There are no colleagues&apos; shifts you could swap with in the next {WEEKS_AHEAD} weeks. You can still ask for someone to cover instead.</p>
      ) : (
        <SwapForm myShiftId={data.mine.id} options={data.options} />
      )}
    </main>
  );
}
