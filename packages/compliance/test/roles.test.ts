import { describe, expect, it } from "vitest";
import { evaluate, jobRole } from "../src/index";

const chef = { id: "chef", name: "Chef" };
const ctx = (roles: string[] | undefined, role: typeof chef | null = chef) => ({
  asOf: "2026-10-11",
  workers: [{ id: "jo", name: "Jo", dateOfBirth: "1990-01-01", roles }],
  shifts: [{ id: "s", workerId: "jo", start: "2026-10-06T08:00:00Z", end: "2026-10-06T12:00:00Z", ...(role ? { role } : {}) }],
  payRates: [],
});

describe("job roles", () => {
  it("warns when someone is put on a shift for a role they are not set up for", () => {
    const [f] = jobRole.check(ctx(["waiter"]));
    expect(f).toMatchObject({ ruleId: "roles.job-role", severity: "warn", workerId: "jo", shiftIds: ["s"] });
    expect(f!.message).toContain("not set up to work as Chef");
  });

  it("is quiet when they have the role, or the shift has none", () => {
    expect(jobRole.check(ctx(["chef"]))).toEqual([]);
    expect(jobRole.check(ctx(undefined, null))).toEqual([]);
  });

  it("runs with the other rules and never blocks publishing", () => {
    const found = evaluate(ctx([])).findings.filter((f) => f.ruleId === "roles.job-role");
    expect(found.map((f) => f.severity)).toEqual(["warn"]);
  });
});
