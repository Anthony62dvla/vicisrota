import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withOrganisation, type Database } from "../src/client";
import { runMigrations } from "../src/migrate";
import { announcement, announcementRead, auditEvent, clockEvent, loneWorkCheck, client, safeguardingAction, safeguardingConcern, shiftClaim, tip, tipAllocation, tipShare, leaveRequest, timeEntry, organisation, qualification, shift, worker, workerCheck, workerUnavailability } from "../src/schema";

// Needs a disposable Postgres database, connected as a non-superuser (superusers bypass row-level security).
// Example: TEST_DATABASE_URL=postgres://vicisrota:vicisrota@localhost:5433/vicisrota_test
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database", () => {
  let db: Database;
  let close: () => Promise<void>;
  let cafe: string;
  let careHome: string;

  beforeAll(async () => {
    const reset = createDb(url!);
    await reset.db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
    await reset.close();
    await runMigrations(url!);
    ({ db, close } = createDb(url!));
    [{ id: cafe }, { id: careHome }] = (await db
      .insert(organisation)
      .values([
        { name: "Corner Cafe", sector: "hospitality" },
        { name: "Oak House", sector: "care" },
      ])
      .returning({ id: organisation.id })) as [{ id: string }, { id: string }];
  });

  afterAll(() => close?.());

  it("only shows each business its own staff", async () => {
    await withOrganisation(db, cafe, (tx) =>
      tx.insert(worker).values({ organisationId: cafe, fullName: "Amy", dateOfBirth: "1990-05-01" }),
    );
    await withOrganisation(db, careHome, (tx) =>
      tx.insert(worker).values({ organisationId: careHome, fullName: "Ben", dateOfBirth: "1985-02-11" }),
    );

    const cafeStaff = await withOrganisation(db, cafe, (tx) => tx.select({ name: worker.fullName }).from(worker));
    expect(cafeStaff).toEqual([{ name: "Amy" }]);
  });

  it("refuses to write a row into another business", async () => {
    await expect(
      withOrganisation(db, cafe, (tx) =>
        tx.insert(worker).values({ organisationId: careHome, fullName: "Intruder", dateOfBirth: "1990-01-01" }),
      ),
    ).rejects.toThrow();
  });

  it("keeps staff checks and training private to each business", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    await withOrganisation(db, cafe, async (tx) => {
      await tx.insert(workerCheck).values({ organisationId: cafe, workerId: amy!.id, kind: "right_to_work", checkedOn: "2026-01-05" });
      await tx.insert(qualification).values({ organisationId: cafe, name: "Food hygiene level 2" });
    });
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(workerCheck))).toEqual([]);
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(qualification))).toEqual([]);
    expect(await withOrganisation(db, cafe, (tx) => tx.select().from(workerCheck))).toHaveLength(1);
  });

  it("keeps leave private and refuses leave that ends before it starts", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    await withOrganisation(db, cafe, (tx) =>
      tx.insert(leaveRequest).values({ organisationId: cafe, workerId: amy!.id, kind: "annual", startsOn: "2026-10-06", endsOn: "2026-10-09", days: 3.5 }),
    );
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(leaveRequest))).toEqual([]);
    const [mine] = await withOrganisation(db, cafe, (tx) => tx.select().from(leaveRequest));
    expect(mine?.days).toBe(3.5);
    await expect(
      withOrganisation(db, cafe, (tx) =>
        tx.insert(leaveRequest).values({ organisationId: cafe, workerId: amy!.id, kind: "sick", startsOn: "2026-10-09", endsOn: "2026-10-06" }),
      ),
    ).rejects.toThrow();
  });

  it("keeps confirmed hours private and refuses impossible times", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    const entry = (startsAt: string, endsAt: string, breakMinutes = 0) =>
      withOrganisation(db, cafe, (tx) =>
        tx.insert(timeEntry).values({ organisationId: cafe, workerId: amy!.id, startsAt: new Date(startsAt), endsAt: new Date(endsAt), breakMinutes }),
      );
    await entry("2026-10-05T08:00:00Z", "2026-10-05T16:00:00Z", 30);
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(timeEntry))).toEqual([]);
    await expect(entry("2026-10-05T16:00:00Z", "2026-10-05T08:00:00Z")).rejects.toThrow();
    await expect(entry("2026-10-05T08:00:00Z", "2026-10-05T09:00:00Z", 60)).rejects.toThrow();
  });

  it("keeps clients private to each care provider", async () => {
    await withOrganisation(db, careHome, (tx) => tx.insert(client).values({ organisationId: careHome, name: "Mrs Evans", postcode: "CF10 1AA" }));
    expect(await withOrganisation(db, cafe, (tx) => tx.select().from(client))).toEqual([]);
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(client))).toHaveLength(1);
  });

  it("keeps shared tips as a permanent record", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    const { allocationId, tipId } = await withOrganisation(db, cafe, async (tx) => {
      const [allocation] = await tx
        .insert(tipAllocation)
        .values({ organisationId: cafe, periodFrom: "2026-10-01", periodTo: "2026-10-31", totalPence: 5000, method: "hours", payBy: "2026-11-30" })
        .returning();
      const [t] = await tx
        .insert(tip)
        .values({ organisationId: cafe, receivedOn: "2026-10-03", amountPence: 5000, source: "card", allocationId: allocation!.id })
        .returning();
      await tx.insert(tipShare).values({ organisationId: cafe, allocationId: allocation!.id, workerId: amy!.id, hours: 12.5, pence: 5000 });
      return { allocationId: allocation!.id, tipId: t!.id };
    });
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(tipShare))).toEqual([]);
    await expect(withOrganisation(db, cafe, (tx) => tx.update(tipShare).set({ pence: 1 }))).rejects.toThrow();
    await expect(withOrganisation(db, cafe, (tx) => tx.delete(tip).where(eq(tip.id, tipId)))).rejects.toThrow();
    await expect(withOrganisation(db, cafe, (tx) => tx.update(tipAllocation).set({ totalPence: 1 }).where(eq(tipAllocation.id, allocationId)))).rejects.toThrow();
    await withOrganisation(db, cafe, (tx) => tx.update(tipAllocation).set({ paidAt: new Date() }).where(eq(tipAllocation.id, allocationId)));
  });

  it("refuses a tip of zero or less", async () => {
    await expect(
      withOrganisation(db, cafe, (tx) => tx.insert(tip).values({ organisationId: cafe, receivedOn: "2026-10-03", amountPence: 0, source: "cash" })),
    ).rejects.toThrow();
  });

  it("allows one open request per person per shift, and keeps claims private", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    const [open] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(shift).values({ organisationId: cafe, startsAt: new Date("2026-10-06T09:00:00Z"), endsAt: new Date("2026-10-06T15:00:00Z") }).returning(),
    );
    const claim = { organisationId: cafe, shiftId: open!.id, workerId: amy!.id };
    await withOrganisation(db, cafe, (tx) => tx.insert(shiftClaim).values(claim));
    await expect(withOrganisation(db, cafe, (tx) => tx.insert(shiftClaim).values(claim))).rejects.toThrow();
    // Once the first request is withdrawn, the person can ask again.
    await withOrganisation(db, cafe, (tx) => tx.update(shiftClaim).set({ status: "withdrawn" }).where(eq(shiftClaim.shiftId, open!.id)));
    await withOrganisation(db, cafe, (tx) => tx.insert(shiftClaim).values(claim));
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(shiftClaim))).toEqual([]);
  });

  it("keeps safeguarding concerns as written, private, and their actions permanent", async () => {
    const [concern] = await withOrganisation(db, careHome, (tx) =>
      tx.insert(safeguardingConcern).values({ organisationId: careHome, category: "abuse_or_neglect", details: "Bruising on arm" }).returning(),
    );
    expect(await withOrganisation(db, cafe, (tx) => tx.select().from(safeguardingConcern))).toEqual([]);
    await withOrganisation(db, careHome, (tx) => tx.update(safeguardingConcern).set({ status: "referred" }).where(eq(safeguardingConcern.id, concern!.id)));
    await expect(
      withOrganisation(db, careHome, (tx) => tx.update(safeguardingConcern).set({ details: "Nothing" }).where(eq(safeguardingConcern.id, concern!.id))),
    ).rejects.toThrow();
    await expect(withOrganisation(db, careHome, (tx) => tx.delete(safeguardingConcern).where(eq(safeguardingConcern.id, concern!.id)))).rejects.toThrow();
    const [action] = await withOrganisation(db, careHome, (tx) =>
      tx.insert(safeguardingAction).values({ organisationId: careHome, concernId: concern!.id, kind: "note", note: "Spoke to family" }).returning(),
    );
    await expect(
      withOrganisation(db, careHome, (tx) => tx.update(safeguardingAction).set({ note: "x" }).where(eq(safeguardingAction.id, action!.id))),
    ).rejects.toThrow();
  });

  it("keeps lone working check-ins permanent and private", async () => {
    const [night] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(shift).values({ organisationId: cafe, startsAt: new Date("2026-10-06T22:00:00Z"), endsAt: new Date("2026-10-07T06:00:00Z"), loneWorking: true }).returning(),
    );
    const [check] = await withOrganisation(db, cafe, (tx) => tx.insert(loneWorkCheck).values({ organisationId: cafe, shiftId: night!.id, kind: "help" }).returning());
    await expect(withOrganisation(db, cafe, (tx) => tx.delete(loneWorkCheck).where(eq(loneWorkCheck.id, check!.id)))).rejects.toThrow();
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(loneWorkCheck))).toEqual([]);
  });

  it("keeps clock-ins permanent and private", async () => {
    const [amy] = await withOrganisation(db, cafe, (tx) => tx.select({ id: worker.id }).from(worker));
    const [day] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(shift).values({ organisationId: cafe, workerId: amy!.id, startsAt: new Date("2026-10-08T08:00:00Z"), endsAt: new Date("2026-10-08T16:00:00Z") }).returning(),
    );
    const [event] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(clockEvent).values({ organisationId: cafe, workerId: amy!.id, shiftId: day!.id, kind: "in", place: "away", distanceMetres: 900 }).returning(),
    );
    await expect(withOrganisation(db, cafe, (tx) => tx.update(clockEvent).set({ place: "at_work" }).where(eq(clockEvent.id, event!.id)))).rejects.toThrow();
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(clockEvent))).toEqual([]);
  });

  it("protects every business table with row-level security, except the few filtered by hand", async () => {
    // These have no policy on purpose and every query on them filters by business in code.
    const filteredInCode = ["membership", "invitation", "kiosk_device"];
    const rows = (await db.execute(sql`
      select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'organisation_id')
    `)) as unknown as { name: string; enabled: boolean; forced: boolean }[];
    const unprotected = rows.filter((r) => !(r.enabled && r.forced) && !filteredInCode.includes(r.name)).map((r) => r.name);
    expect(rows.length).toBeGreaterThan(20);
    expect(unprotected).toEqual([]);
  });

  it("keeps availability private and refuses impossible times", async () => {
    const [jo] = await withOrganisation(db, cafe, (tx) => tx.insert(worker).values({ organisationId: cafe, fullName: "Jo", dateOfBirth: "1990-01-01" }).returning());
    await withOrganisation(db, cafe, (tx) => tx.insert(workerUnavailability).values({ organisationId: cafe, workerId: jo!.id, weekday: 1, startsAt: "15:00", endsAt: "24:00" }));
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(workerUnavailability))).toEqual([]);
    for (const bad of [{ weekday: 8, startsAt: "09:00", endsAt: "10:00" }, { weekday: 1, startsAt: "17:00", endsAt: "15:00" }, { weekday: 1, startsAt: "9am", endsAt: "10:00" }])
      await expect(withOrganisation(db, cafe, (tx) => tx.insert(workerUnavailability).values({ organisationId: cafe, workerId: jo!.id, ...bad }))).rejects.toThrow();
  });

  it("keeps announcement wording and read confirmations as they were", async () => {
    const [sam] = await withOrganisation(db, cafe, (tx) => tx.insert(worker).values({ organisationId: cafe, fullName: "Sam", dateOfBirth: "1990-01-01" }).returning());
    const [post] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(announcement).values({ organisationId: cafe, title: "New fire exits", body: "Use the side door.", needsConfirmation: true }).returning(),
    );
    await withOrganisation(db, cafe, (tx) => tx.insert(announcementRead).values({ organisationId: cafe, announcementId: post!.id, workerId: sam!.id }));
    await expect(withOrganisation(db, cafe, (tx) => tx.update(announcement).set({ body: "Use the front door." }).where(eq(announcement.id, post!.id)))).rejects.toThrow();
    await expect(withOrganisation(db, cafe, (tx) => tx.delete(announcement).where(eq(announcement.id, post!.id)))).rejects.toThrow();
    await expect(withOrganisation(db, cafe, (tx) => tx.delete(announcementRead))).rejects.toThrow();
    await expect(withOrganisation(db, cafe, (tx) => tx.insert(announcementRead).values({ organisationId: cafe, announcementId: post!.id, workerId: sam!.id }))).rejects.toThrow();
    await withOrganisation(db, cafe, (tx) => tx.update(announcement).set({ archivedAt: new Date() }).where(eq(announcement.id, post!.id)));
    expect(await withOrganisation(db, careHome, (tx) => tx.select().from(announcement))).toEqual([]);
  });

  it("shows nothing when no business is set", async () => {
    expect(await db.select().from(worker)).toEqual([]);
  });

  it("refuses a shift that ends before it starts", async () => {
    await expect(
      withOrganisation(db, cafe, (tx) =>
        tx.insert(shift).values({
          organisationId: cafe,
          startsAt: new Date("2026-10-05T17:00:00Z"),
          endsAt: new Date("2026-10-05T09:00:00Z"),
        }),
      ),
    ).rejects.toThrow();
  });

  it("keeps the audit trail append-only", async () => {
    const [event] = await withOrganisation(db, cafe, (tx) =>
      tx.insert(auditEvent).values({ organisationId: cafe, action: "create", entity: "worker" }).returning(),
    );
    await expect(
      withOrganisation(db, cafe, (tx) => tx.update(auditEvent).set({ action: "edited" }).where(eq(auditEvent.id, event!.id))),
    ).rejects.toThrow();
    await expect(
      withOrganisation(db, cafe, (tx) => tx.delete(auditEvent).where(eq(auditEvent.id, event!.id))),
    ).rejects.toThrow();
  });
});
