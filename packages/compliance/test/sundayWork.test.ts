import { describe, expect, it } from "vitest";
import { evaluate, sundayOptOutFrom } from "../src";

const worker = (sundayOptOutFrom?: string) => ({ id: "a", name: "Alex", dateOfBirth: "1990-01-01", sundayOptOutFrom });
const shift = (id: string, start: string, end: string) => ({ id, workerId: "a", start, end, breaks: [] });
const run = (from: string | undefined, shifts: ReturnType<typeof shift>[]) =>
  evaluate({ asOf: "2026-10-18", workers: [worker(from)], shifts }).findings.filter((f) => f.ruleId === "shop.sunday-opt-out");

describe("Sunday working opt-out", () => {
  it("takes effect 3 months after notice, or 1 month without the explanatory statement", () => {
    expect(sundayOptOutFrom("2026-07-15", true)).toBe("2026-10-15");
    expect(sundayOptOutFrom("2026-07-15", false)).toBe("2026-08-15");
    expect(sundayOptOutFrom("2026-11-30", true)).toBe("2027-02-28");
  });

  it("warns about Sunday shifts once the opt-out applies, including overnight shifts into Sunday", () => {
    const sunday = shift("1", "2026-10-18T09:00:00+01:00", "2026-10-18T17:00:00+01:00");
    expect(run("2026-10-15", [sunday])[0]).toMatchObject({ severity: "warn", shiftIds: ["1"] });
    expect(run("2026-10-15", [shift("2", "2026-10-17T22:00:00+01:00", "2026-10-18T06:00:00+01:00")])).toHaveLength(1);
  });

  it("is quiet during the notice period, on other days, and without an opt-out", () => {
    expect(run("2026-10-20", [shift("1", "2026-10-18T09:00:00+01:00", "2026-10-18T17:00:00+01:00")])).toEqual([]);
    expect(run("2026-10-15", [shift("1", "2026-10-17T09:00:00+01:00", "2026-10-17T17:00:00+01:00")])).toEqual([]);
    expect(run(undefined, [shift("1", "2026-10-18T09:00:00+01:00", "2026-10-18T17:00:00+01:00")])).toEqual([]);
  });
});
