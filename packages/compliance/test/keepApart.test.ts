import { describe, expect, it } from "vitest";
import { evaluate } from "../src";

const workers = [
  { id: "a", name: "Alex", dateOfBirth: "1990-01-01" },
  { id: "b", name: "Bea", dateOfBirth: "1990-01-01" },
  { id: "c", name: "Cal", dateOfBirth: "1990-01-01" },
];
const shift = (id: string, workerId: string, start: string, end: string, locationId?: string) => ({ id, workerId, start: `2026-10-12T${start}:00Z`, end: `2026-10-12T${end}:00Z`, breaks: [], locationId });
const keep = (ctx: { shifts: ReturnType<typeof shift>[] }) =>
  evaluate({ asOf: "2026-10-12", workers, ...ctx, keepApart: [{ workerIds: ["a", "b"] }] }).findings.filter((f) => f.ruleId === "safety.keep-apart");

describe("keeping named people apart", () => {
  it("blocks overlapping shifts for a pair, privately", () => {
    const found = keep({ shifts: [shift("1", "a", "08:00", "12:00"), shift("2", "b", "11:00", "15:00")] });
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ severity: "block", confidential: true, shiftIds: ["1", "2"] });
    expect(found[0]!.message).toContain("Alex and Bea are set to be kept apart");
  });

  it("allows back-to-back shifts, other people, and different workplaces", () => {
    expect(keep({ shifts: [shift("1", "a", "08:00", "12:00"), shift("2", "b", "12:00", "16:00")] })).toEqual([]);
    expect(keep({ shifts: [shift("1", "a", "08:00", "12:00"), shift("2", "c", "08:00", "12:00")] })).toEqual([]);
    expect(keep({ shifts: [shift("1", "a", "08:00", "12:00", "north"), shift("2", "b", "08:00", "12:00", "south")] })).toEqual([]);
  });
});
