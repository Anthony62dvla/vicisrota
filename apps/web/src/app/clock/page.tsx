import { nextClockActions } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { clockableShifts } from "@/lib/clock";
import { db } from "@/lib/db";
import { scannedTablet } from "@/lib/qr-clock";
import { QrClockForm, type QrShift } from "./form";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const STATUS = { not_in: "Not clocked in yet", in: "Clocked in", on_break: "On a break", out: "Clocked out" } as const;

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-3 text-lg">{children}</div>
    </main>
  );
}

/** Opened by scanning the QR code on a clock-in tablet with a phone. */
export default async function ClockPage({ searchParams }: PageProps<"/clock">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const code = { k: one(q.k), w: one(q.w), s: one(q.s) };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/clock?k=${code.k}&w=${code.w}&s=${code.s}`)}`);

  const scan = await scannedTablet(code);
  if ("error" in scan) {
    return scan.error === "expired" ? (
      <Notice title="Scan the code again">
        <p>The code on the tablet changes every 30 seconds, and this one has changed. Point your camera at the tablet again.</p>
      </Notice>
    ) : (
      <Notice title="This code did not work">
        <p>It is not a VicisRota clock-in code, or the tablet is no longer set up. Ask a manager, or clock in from your home page.</p>
        <p className="mt-4"><Link href="/me" className="underline">Go to your home page</Link></p>
      </Notice>
    );
  }
  const { organisationId, locationId } = scan.device;
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const now = new Date().getTime();
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.userId, session.user.id));
    if (!worker) return null;
    const [place] = await tx.select({ name: schema.location.name }).from(schema.location).where(eq(schema.location.id, locationId));
    const shifts = (await clockableShifts(tx, worker.id, now)).filter((c) => !c.shift.locationId || c.shift.locationId === locationId);
    return { worker, place: place?.name ?? "work", shifts };
  });
  if (!data) {
    return (
      <Notice title="You are not on the staff list here">
        <p>This tablet belongs to a business you are not a member of. Ask a manager to invite you.</p>
      </Notice>
    );
  }
  const list: QrShift[] = data.shifts
    .map((c) => ({
      shiftId: c.shift.id,
      times: `${timeFmt.format(c.shift.startsAt)} to ${timeFmt.format(c.shift.endsAt)}`,
      status: STATUS[c.summary.state],
      actions: nextClockActions(c.summary.state) as QrShift["actions"],
    }))
    .filter((s) => s.actions.length > 0);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{data.place}</p>
      <h1 className="text-2xl font-semibold">Hello, {data.worker.fullName.split(" ")[0]}</h1>
      {list.length === 0 ? (
        <p className="mt-4 text-lg">
          You have no shift to clock in or out of right now. You can clock in from an hour before your shift starts.
        </p>
      ) : (
        list.map((s) => (
          <section key={s.shiftId} className="mt-6 rounded-xl border-2 border-brand bg-surface p-4">
            <h2 className="text-xl font-semibold">Your shift, {s.times}</h2>
            <p className="text-zinc-600 dark:text-zinc-400">{s.status}</p>
            <QrClockForm code={code} shift={s} />
          </section>
        ))
      )}
    </main>
  );
}
