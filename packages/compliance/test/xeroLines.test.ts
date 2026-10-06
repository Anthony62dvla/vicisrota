import { describe, expect, it } from "vitest";
import { dailyHours, matchEmployees } from "../src/index";

describe("timesheet lines for payroll software", () => {
  it("adds up confirmed hours per UK day, after breaks", () => {
    expect(
      dailyHours([
        { start: "2026-10-13T08:00:00Z", end: "2026-10-13T16:30:00Z", breakMinutes: 30 },
        { start: "2026-10-13T18:00:00Z", end: "2026-10-13T20:00:00Z", breakMinutes: 0 },
        // 23:30 UK time on the 14th starts on the 14th, though it is the 14th in UTC as well.
        { start: "2026-10-14T22:30:00Z", end: "2026-10-15T02:00:00Z", breakMinutes: 0 },
      ]),
    ).toEqual([
      { date: "2026-10-13", hours: 10 },
      { date: "2026-10-14", hours: 3.5 },
    ]);
  });

  it("counts only the time woken during a sleep-in", () => {
    expect(dailyHours([{ start: "2026-10-13T21:00:00Z", end: "2026-10-14T07:00:00Z", breakMinutes: 0, sleepIn: true, awakeMinutes: 45 }])).toEqual([
      { date: "2026-10-13", hours: 0.75 },
    ]);
  });

  it("matches by payroll ID, then by a unique name", () => {
    const employees = [
      { id: "x1", name: "Mia Chen" },
      { id: "x2", name: "Sam Jones" },
      { id: "x3", name: "Sam Jones" },
      { id: "x4", name: "Ana Popescu" },
    ];
    const m = matchEmployees(
      [
        { id: "a", name: "mia  chen", payrollId: null },
        { id: "b", name: "Sam Jones", payrollId: null },
        { id: "c", name: "Ana P", payrollId: "x4" },
      ],
      employees,
    );
    expect([...m].map(([k, v]) => [k, v.id])).toEqual([
      ["a", "x1"],
      ["c", "x4"],
    ]);
  });
});
