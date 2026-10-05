import { describe, expect, it } from "vitest";
import { autoAssign, type Context, type OpenShift, type Worker } from "../src/index";

const rtw = [{ kind: "right_to_work" as const, checkedOn: "2026-01-05" }];
const person = (id: string, extra: Partial<Worker> = {}): Worker => ({ id, name: id, dateOfBirth: "1990-05-01", checks: rtw, ...extra });
// Week of Monday 5 October 2026, British Summer Time (UTC+1).
const open = (id: string, day: number, from = "09:00", to = "15:00"): OpenShift => ({
  id,
  start: `2026-10-${String(5 + day).padStart(2, "0")}T${from}:00+01:00`,
  end: `2026-10-${String(5 + day).padStart(2, "0")}T${to}:00+01:00`,
});
const ctx = (workers: Worker[], shifts: Context["shifts"] = []): Context => ({
  asOf: "2026-10-11",
  workers,
  shifts,
  payRates: workers.map((w) => ({ workerId: w.id, hourlyPence: 1300, effectiveFrom: "2026-04-01" })),
});

describe("automatic rota builder", () => {
  it("shares shifts out so the person with fewest hours goes first", () => {
    const result = autoAssign(ctx([person("ana"), person("ben")]), [open("a", 0), open("b", 1), open("c", 2), open("d", 3)], "2026-10-05");
    const count = (id: string) => result.assigned.filter((a) => a.workerId === id).length;
    expect(result.unfilled).toEqual([]);
    expect([count("ana"), count("ben")]).toEqual([2, 2]);
  });

  it("never gives a shift that clashes with what someone has said they cannot do", () => {
    const ana = person("ana", { unavailable: [{ weekday: 1, from: "00:00", to: "24:00" }] });
    const ben = person("ben", { adjustments: { earliestStart: "10:00" } });
    const result = autoAssign(ctx([ana, ben]), [open("mon", 0)], "2026-10-05");
    expect(result.assigned).toEqual([]);
    expect(result.unfilled).toEqual([{ shiftId: "mon", reason: expect.any(String) }]);
  });

  it("fills the hardest shift first, so a shift only one person can do is not lost", () => {
    // Only ana can work Tuesday; both can work Monday. Ana has more hours already, but still gets Tuesday.
    const ben = person("ben", { unavailable: [{ weekday: 2, from: "00:00", to: "24:00" }] });
    const result = autoAssign(ctx([person("ana"), ben]), [open("mon", 0), open("tue", 1)], "2026-10-05");
    expect(result.assigned).toContainEqual({ shiftId: "tue", workerId: "ana" });
    expect(result.assigned).toContainEqual({ shiftId: "mon", workerId: "ben" });
  });

  it("does not give one person two shifts at the same time", () => {
    const result = autoAssign(ctx([person("ana")]), [open("a", 0, "09:00", "15:00"), open("b", 0, "12:00", "17:00")], "2026-10-05");
    expect(result.assigned).toHaveLength(1);
    expect(result.unfilled).toEqual([{ shiftId: expect.any(String), reason: "everyone who could do it is already working then" }]);
  });

  it("does not break rest rules: a late finish then an early start goes to someone else", () => {
    const result = autoAssign(ctx([person("ana"), person("ben")]), [open("late", 0, "16:00", "22:00"), open("early", 1, "06:00", "12:00")], "2026-10-05");
    expect(new Set(result.assigned.map((a) => a.workerId)).size).toBe(2);
  });

  it("says when there is nobody to give shifts to", () => {
    expect(autoAssign(ctx([]), [open("a", 0)], "2026-10-05").unfilled).toEqual([{ shiftId: "a", reason: "there is nobody on the staff list yet" }]);
  });
});
