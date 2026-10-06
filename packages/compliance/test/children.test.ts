import { describe, expect, it } from "vitest";
import { evaluate, isSchoolAge, schoolLeavingDate } from "../src";

// 14 October 2026 is a Wednesday, in British Summer Time.
const child = (over: object = {}) => ({ id: "c", name: "Kim", dateOfBirth: "2012-03-01", childWorkPermit: { expiresOn: "2027-03-01" }, ...over });
const shift = (id: string, date: string, start: string, end: string, breaks: { start: string; end: string }[] = []) => ({
  id,
  workerId: "c",
  start: `${date}T${start}:00+01:00`,
  end: `${date}T${end}:00+01:00`,
  breaks,
});
const run = (worker: object, shifts: ReturnType<typeof shift>[]) =>
  evaluate({ asOf: "2026-10-18", workers: [worker as never], shifts }).findings.filter((f) => f.ruleId === "children.employment");

describe("children of school age", () => {
  it("works out the school leaving date", () => {
    expect(schoolLeavingDate("2010-03-01")).toBe("2026-06-26");
    expect(schoolLeavingDate("2010-10-01")).toBe("2027-06-25");
    expect(isSchoolAge("2010-03-01", "2026-06-26")).toBe(false);
    expect(isSchoolAge("2010-03-01", "2026-06-25")).toBe(true);
  });

  it("needs a work permit, and blocks under-13s", () => {
    expect(run(child({ childWorkPermit: null }), [shift("1", "2026-10-17", "09:00", "12:00")]).map((f) => f.message)).toEqual([
      "Kim is of school age and needs a work permit from the council before working on Saturday 17 October. Record it on their staff record.",
    ]);
    expect(run(child({ dateOfBirth: "2014-01-01" }), [shift("1", "2026-10-17", "09:00", "12:00")])[0]!.message).toBe("Kim is 12. Children under 13 cannot be employed.");
  });

  it("blocks work before 7am or after 7pm, long days, Sundays over 2 hours, and no break after 4 hours", () => {
    const found = run(child(), [
      shift("1", "2026-10-17", "06:30", "12:00", [{ start: "2026-10-17T10:00:00+01:00", end: "2026-10-17T11:00:00+01:00" }]),
      shift("2", "2026-10-18", "10:00", "13:00"),
    ]);
    expect(found.map((f) => [f.severity, f.shiftIds.join()])).toEqual([
      ["block", "1"],
      ["block", "2"],
    ]);
    expect(run(child(), [shift("1", "2026-10-17", "09:00", "15:00")]).map((f) => f.message)).toEqual([
      "Kim is of school age and needs a 1-hour break after 4 hours of work.",
      "Kim is of school age and can work at most 5 hours on a day. This day has 6h.",
    ]);
  });

  it("warns about school-day and term-time limits, which only the business can judge", () => {
    const found = run(child(), [shift("1", "2026-10-14", "16:00", "18:00"), shift("2", "2026-10-15", "10:00", "12:00")]);
    expect(found.map((f) => [f.severity, f.shiftIds.join()])).toEqual([["warn", "2"]]);
  });

  it("ignores anyone past school leaving age", () => {
    expect(run(child({ dateOfBirth: "2009-01-01", childWorkPermit: null }), [shift("1", "2026-10-17", "05:00", "22:00")])).toEqual([]);
  });
});

describe("night worker health assessment", () => {
  const worker = (nightHealthOfferedOn?: string) => ({ id: "c", name: "Sam", dateOfBirth: "1990-01-01", nightHealthOfferedOn });
  const night = { id: "n", workerId: "c", start: "2026-10-14T22:00:00+01:00", end: "2026-10-15T07:00:00+01:00", breaks: [] };
  const check = (w: object) => evaluate({ asOf: "2026-10-18", workers: [w as never], shifts: [night] }).findings.filter((f) => f.ruleId === "wtr.night-health");

  it("asks for a health assessment to be offered before nights, and every year", () => {
    expect(check(worker())[0]).toMatchObject({ severity: "warn", shiftIds: ["n"] });
    expect(check(worker("2025-09-01"))[0]!.message).toContain("over a year ago");
    expect(check(worker("2026-01-10"))).toEqual([]);
  });

  it("does not count shifts with under 3 hours at night", () => {
    const late = { ...night, start: "2026-10-14T16:00:00+01:00", end: "2026-10-15T01:30:00+01:00" };
    expect(evaluate({ asOf: "2026-10-18", workers: [worker() as never], shifts: [late] }).findings.filter((f) => f.ruleId === "wtr.night-health")).toEqual([]);
  });
});
