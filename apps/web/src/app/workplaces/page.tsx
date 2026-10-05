import Link from "next/link";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { revokeKiosk, setLocationRule, setUpKiosk } from "./actions";
import { AddWorkplaceForm } from "./forms";

const RULES = [
  { value: "off", label: "Off", detail: "Staff can clock in from their phone anywhere." },
  { value: "record", label: "Note it", detail: "Staff can clock in anywhere, but timesheets show anyone who was away from work." },
  { value: "require", label: "Require it", detail: "Staff can only clock in from their phone at work. Clocking out is never blocked." },
] as const;

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function WorkplacesPage() {
  const { organisationId } = await requireManager();
  const { places, org, kiosks } = await withOrganisation(db, organisationId, async (tx) => ({
    places: await tx.select().from(schema.location).orderBy(asc(schema.location.name)),
    org: (await tx.select({ rule: schema.organisation.clockLocationRule }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0],
    kiosks: await tx
      .select({ device: schema.kioskDevice, place: schema.location.name })
      .from(schema.kioskDevice)
      .innerJoin(schema.location, eq(schema.kioskDevice.locationId, schema.location.id))
      // kiosk_device has no row-level security, so filter by business explicitly.
      .where(and(eq(schema.kioskDevice.organisationId, organisationId), isNull(schema.kioskDevice.revokedAt)))
      .orderBy(desc(schema.kioskDevice.createdAt)),
  }));
  const mapped = places.filter((p) => p.latitude !== null);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Workplaces and clocking in</h1>
      <p className="mt-1">Where your staff work, whether phone clock-ins check they are there, and in-store clock-in tablets.</p>

      <section className="mt-8" aria-labelledby="places-heading">
        <h2 id="places-heading" className="text-lg font-semibold">Workplaces</h2>
        {places.length === 0 ? (
          <p className="mt-2">No workplaces yet. Add the first below.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {places.map((p) => (
              <li key={p.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {p.address && `${p.address} · `}
                  {p.latitude === null ? "Location not set" : `Location set, within ${p.radiusMetres} metres counts as at work`}
                </p>
                <Link href={`/workplaces/poster?l=${p.id}`} className="mt-2 inline-block text-sm underline">
                  Print a QR code poster for {p.name}
                </Link>
                <form action={setUpKiosk} className="mt-2">
                  <input type="hidden" name="locationId" value={p.id} />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Use this device as the clock-in tablet here</button>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    Do this on the tablet or computer that stays at {p.name}. You will be signed out of it, so it can only be used for clocking in.
                  </span>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddWorkplaceForm />
      </section>

      <section className="mt-10" aria-labelledby="rule-heading">
        <h2 id="rule-heading" className="text-lg font-semibold">Location checks for phone clock-ins</h2>
        <p className="mt-1">
          The phone&apos;s location is checked only at the moment someone taps a clock button. Only whether they were at work, and how far
          away, is saved. Tell your staff before you turn this on.
        </p>
        {mapped.length === 0 && <p className="mt-2 font-medium">Set the location of at least one workplace first.</p>}
        <form action={setLocationRule} className="mt-3 flex flex-col gap-2">
          {RULES.map((r) => (
            <label key={r.value} className="flex items-start gap-2">
              <input type="radio" name="rule" value={r.value} defaultChecked={org?.rule === r.value} className="mt-1" />
              <span>
                {r.label}
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">{r.detail}</span>
              </span>
            </label>
          ))}
          <button type="submit" className="self-start rounded-lg border border-zinc-400 px-4 py-2">Save</button>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="kiosk-heading">
        <h2 id="kiosk-heading" className="text-lg font-semibold">Clock-in tablets</h2>
        <p className="mt-1">
          Staff clock in on the tablet in one of two ways. They type a PIN they chose on their home page, or they scan the QR code with their own phone. The code
          changes every 30 seconds, so it only works for someone standing at the tablet.
        </p>
        {kiosks.length === 0 ? (
          <p className="mt-2">None set up yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {kiosks.map(({ device, place }) => (
              <li key={device.id} className="flex flex-wrap items-center gap-3">
                <span>
                  Tablet at {place}, set up {dateFmt.format(device.createdAt)}
                  {device.lastSeenAt && `, last used ${dateFmt.format(device.lastSeenAt)}`}
                </span>
                <form action={revokeKiosk}>
                  <input type="hidden" name="id" value={device.id} />
                  <button type="submit" className="text-sm underline">Stop this tablet working</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
