import { describe, expect, it } from "vitest";
import { londonDateTime, staffingGaps, type StaffingLevel, type StaffingShift } from "../src";

// Monday 12 October 2026. The UK is on British Summer Time, so 08:00 is 07:00Z.
const week = "2026-10-12";
const at = (date: string, time: string) => new Date(londonDateTime(date, time)).toISOString();
const level = (l: Partial<StaffingLevel> = {}): StaffingLevel => ({
  id: "day",
  place: "Oak unit",
  locationId: "oak",
  roleId: null,
  weekdays: [1],
  from: "08:00",
  to: "20:00",
  minPeople: 2,
  strict: true,
  ...l,
});
let n = 0;
const shift = (workerId: string | null, from: string, to: string, s: Partial<StaffingShift> = {}, date = week): StaffingShift => ({
  id: `s${n++}`,
  workerId,
  locationId: "oak",
  roleId: null,
  start: at(date, from),
  end: to <= from ? at("2026-10-13", to) : at(date, to),
  ...s,
});
const gaps = (levels: StaffingLevel[], shifts: StaffingShift[], workerRoles?: Map<string, string[]>) =>
  staffingGaps({ levels, shifts, weekStart: week, workerRoles });

describe("safe staffing levels", () => {
  it("finds nothing when enough people cover the whole window", () => {
    expect(gaps([level()], [shift("a", "08:00", "20:00"), shift("b", "07:30", "14:00"), shift("c", "14:00", "20:30")])).toEqual([]);
  });

  it("reports the exact stretch that is short, with how many are on", () => {
    const [g, ...rest] = gaps([level()], [shift("a", "08:00", "20:00"), shift("b", "08:00", "12:00"), shift("c", "13:30", "20:00")]);
    expect(rest).toEqual([]);
    expect(g!.message).toBe("Oak unit needs at least 2 people on Monday 12 October from 12:00 to 13:30 (1.5 hours), but only 1 is on the rota.");
    expect([g!.have, g!.need, g!.strict]).toEqual([1, 2, true]);
  });

  it("joins back-to-back short pieces into one gap and says when nobody is on", () => {
    const [g] = gaps([level({ minPeople: 1 })], [shift("a", "08:00", "10:00"), shift("b", "18:00", "20:00")]);
    expect(g!.message).toContain("from 10:00 to 18:00 (8 hours), but nobody is on the rota");
  });

  it("splits a gap where the number on changes, so each line says how many are on", () => {
    const found = gaps([level()], [shift("a", "08:00", "14:00")]);
    expect(found.map((g) => g.message)).toEqual([
      "Oak unit needs at least 2 people on Monday 12 October from 08:00 to 14:00 (6 hours), but only 1 is on the rota.",
      "Oak unit needs at least 2 people on Monday 12 October from 14:00 to 20:00 (6 hours), but nobody is on the rota.",
    ]);
  });

  it("does not count open shifts, other workplaces, or the same person twice", () => {
    const shifts = [shift(null, "08:00", "20:00"), shift("a", "08:00", "20:00", { locationId: "elm" }), shift("b", "08:00", "14:00"), shift("b", "14:00", "20:00")];
    const [g] = gaps([level()], shifts);
    expect([g!.have, g!.from, g!.to]).toEqual([1, londonDateTime(week, "08:00"), londonDateTime(week, "20:00")]);
  });

  it("counts every workplace for a whole-business level", () => {
    expect(gaps([level({ locationId: null, place: "Whole business" })], [shift("a", "08:00", "20:00", { locationId: "elm" }), shift("b", "08:00", "20:00")])).toEqual([]);
  });

  it("checks skill mix by the shift's role, or the person's roles when the shift has none", () => {
    const senior = level({ id: "senior", roleId: "senior", roleName: "Senior carer", minPeople: 1 });
    const roles = new Map([["b", ["senior"]]]);
    expect(gaps([senior], [shift("a", "08:00", "20:00", { roleId: "carer" })], roles)[0]!.message).toBe(
      "Oak unit needs at least 1 Senior carer on Monday 12 October from 08:00 to 20:00 (12 hours), but nobody is on the rota.",
    );
    expect(gaps([senior], [shift("a", "08:00", "14:00", { roleId: "senior" }), shift("b", "14:00", "20:00")], roles)).toEqual([]);
  });

  it("runs past midnight for night levels and only on the chosen days", () => {
    const night = level({ id: "night", from: "20:00", to: "08:00", minPeople: 1, weekdays: [1, 3] });
    const found = gaps([night], [shift("a", "20:00", "06:00")]);
    expect(found).toHaveLength(2);
    expect(found[0]!.message).toBe("Oak unit needs at least 1 person on Monday 12 October from 06:00 to 08:00 (2 hours), but nobody is on the rota.");
    expect(found[0]!.date).toBe(week);
    expect(found[1]!.date).toBe("2026-10-14");
  });

  it("treats 24:00 as midnight at the end of the day", () => {
    const evening = level({ from: "20:00", to: "24:00", minPeople: 1 });
    expect(gaps([evening], [shift("a", "20:00", "00:00")])).toEqual([]);
  });
});
