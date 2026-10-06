import { describe, expect, it } from "vitest";
import { evaluate } from "../src";

const workers = [
  { id: "a", name: "Alex", dateOfBirth: "1990-01-01" },
  { id: "b", name: "Bea", dateOfBirth: "1990-01-01" },
];
// 12 October 2026 is British Summer Time, so 15:00Z is 16:00 in London.
const shift = (id: string, workerId: string, start: string, end: string, locationId: string | null = null) => ({
  id,
  workerId,
  start: `2026-10-12T${start}:00Z`,
  end: `2026-10-12T${end}:00Z`,
  breaks: [],
  locationId,
});
const run = (shifts: ReturnType<typeof shift>[], hours?: { from: string; to: string }, holderIds = ["a"]) =>
  evaluate({ asOf: "2026-10-12", workers, shifts, licensing: { places: [{ locationId: null, name: "", hours }], holderIds } }).findings.filter(
    (f) => f.ruleId === "hospitality.licence-holder",
  );

describe("personal licence holder on shift", () => {
  it("warns about the time when staff work without a licence holder", () => {
    const found = run([shift("1", "a", "15:00", "19:00"), shift("2", "b", "14:00", "22:00")]);
    expect(found.map((f) => f.message)).toEqual([
      "No one with a personal licence is on shift on Monday 12 October from 15:00 to 16:00. Alcohol can only be sold with a licence holder's authority, and your premises licence may need one on site.",
      "No one with a personal licence is on shift on Monday 12 October from 20:00 to 23:00. Alcohol can only be sold with a licence holder's authority, and your premises licence may need one on site.",
    ]);
    expect(found[0]).toMatchObject({ severity: "warn", shiftIds: ["2"] });
  });

  it("only looks at licensed hours when they are set, including past midnight", () => {
    expect(run([shift("1", "a", "15:00", "19:00"), shift("2", "b", "14:00", "22:00")], { from: "16:00", to: "20:00" })).toEqual([]);
    expect(run([shift("1", "a", "15:00", "19:00"), shift("2", "b", "14:00", "22:00")], { from: "18:00", to: "00:30" })).toHaveLength(1);
  });

  it("is quiet when a holder covers the time, or the place does not sell alcohol", () => {
    expect(run([shift("1", "a", "14:00", "22:00"), shift("2", "b", "14:00", "22:00")])).toEqual([]);
    expect(run([shift("1", "b", "14:00", "22:00", "kitchen")])).toEqual([]);
    expect(evaluate({ asOf: "2026-10-12", workers, shifts: [shift("1", "b", "14:00", "22:00")] }).findings.filter((f) => f.ruleId === "hospitality.licence-holder")).toEqual([]);
  });

  it("ignores gaps shorter than 15 minutes", () => {
    expect(run([shift("1", "a", "15:00", "19:00"), shift("2", "b", "14:50", "19:00")])).toEqual([]);
  });
});
