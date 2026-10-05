import { nextClockActions } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { CLOCK_IN_EARLY_MS, CLOCK_OUT_LATE_MS, clockSummaries } from "@/lib/clock";
import { db } from "@/lib/db";
import { currentKiosk } from "@/lib/kiosk";
import { Kiosk, type KioskPerson } from "./kiosk";
import { KioskQr } from "./qr";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const STATUS = { not_in: "Not clocked in", in: "Clocked in", on_break: "On a break", out: "Clocked out" } as const;

/** "Mia Chen" shows as "Mia C.", so the tablet does not display everyone's full name. */
const shortName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.at(-1)![0]}.` : first!;
};

export default async function KioskPage() {
  const kiosk = await currentKiosk();
  if (!kiosk) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Clock-in tablet</h1>
        <p className="mt-2">
          This device is not set up for clocking in. A manager can set it up from Workplaces, on this device.
        </p>
      </main>
    );
  }
  const { organisationId, locationId } = kiosk.device;
  const people = await withOrganisation(db, organisationId, async (tx) => {
    const now = new Date().getTime();
    const [place] = await tx.select({ name: schema.location.name }).from(schema.location).where(eq(schema.location.id, locationId));
    const rows = await tx
      .select({ shift: schema.shift, name: schema.worker.fullName })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .where(
        and(
          eq(schema.shift.status, "published"),
          isNotNull(schema.shift.workerId),
          lt(schema.shift.startsAt, new Date(now + CLOCK_IN_EARLY_MS)),
          gt(schema.shift.endsAt, new Date(now - CLOCK_OUT_LATE_MS)),
          or(isNull(schema.shift.locationId), eq(schema.shift.locationId, locationId)),
        ),
      )
      .orderBy(asc(schema.shift.startsAt), asc(schema.worker.fullName));
    const clocks = await clockSummaries(tx, rows.map((r) => r.shift), now);
    return {
      place: place?.name ?? "",
      list: rows
        .map(({ shift, name }, i): KioskPerson => {
          const { state } = clocks[i]!.summary;
          return {
            shiftId: shift.id,
            name: shortName(name),
            times: `${timeFmt.format(shift.startsAt)} to ${timeFmt.format(shift.endsAt)}`,
            status: STATUS[state],
            actions: nextClockActions(state) as KioskPerson["actions"],
          };
        })
        .filter((p) => p.actions.length > 0),
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{kiosk.businessName}</p>
      <h1 className="text-3xl font-semibold">Clock in at {people.place}</h1>
      <p className="mt-1 text-lg">Tap your name and what you are doing, then enter your PIN.</p>
      <Kiosk people={people.list} />
      <KioskQr />
    </main>
  );
}
