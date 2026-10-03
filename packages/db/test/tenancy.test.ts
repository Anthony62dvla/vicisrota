import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withOrganisation, type Database } from "../src/client";
import { runMigrations } from "../src/migrate";
import { auditEvent, client, tip, tipAllocation, tipShare, leaveRequest, timeEntry, organisation, qualification, shift, worker, workerCheck } from "../src/schema";

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
