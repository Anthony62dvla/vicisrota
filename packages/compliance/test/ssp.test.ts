import { describe, expect, it } from "vitest";
import { sspInPeriod, statutorySickPay, usualWorkingWeekdays } from "../src/index";

const MON_FRI = [1, 2, 3, 4, 5];
const spell = (id: string, startsOn: string, endsOn: string, averageWeeklyEarningsPence = 50000) => ({ id, startsOn, endsOn, averageWeeklyEarningsPence });

describe("statutory sick pay from 6 April 2026", () => {
  it("pays from the first day, even for a single day off", () => {
    // Wednesday 7 October 2026, one day.
    const { spells } = statutorySickPay([spell("a", "2026-10-07", "2026-10-07")], MON_FRI);
    expect(spells[0]).toMatchObject({ qualifyingDays: 1, paidDays: 1, pence: Math.round(12325 / 5), weeklyPence: 12325, linked: false, oldRules: false });
  });

  it("pays only the days the person normally works", () => {
    // Monday 5 to Sunday 11 October: five weekdays, worked Mon to Fri.
    const week = statutorySickPay([spell("a", "2026-10-05", "2026-10-11")], MON_FRI).spells[0]!;
    expect(week).toMatchObject({ qualifyingDays: 5, paidDays: 5, pence: 12325, fitNoteNeeded: false });
    // Same week for someone who works Saturday and Sunday only.
    const weekend = statutorySickPay([spell("a", "2026-10-05", "2026-10-11")], [0, 6]).spells[0]!;
    expect(weekend).toMatchObject({ qualifyingDays: 2, paidDays: 2, pence: 12325 });
  });

  it("pays 80% of average weekly earnings when that is lower than the weekly rate", () => {
    // Earning £100 a week: SSP is £80 a week, where before April 2026 they would have had nothing.
    const { spells } = statutorySickPay([spell("a", "2026-10-05", "2026-10-09", 10000)], MON_FRI);
    expect(spells[0]).toMatchObject({ weeklyPence: 8000, pence: 8000 });
  });

  it("links spells 56 days or less apart and uses the earnings from the start of the period", () => {
    const { spells } = statutorySickPay(
      [
        spell("first", "2026-10-05", "2026-10-06", 10000),
        // Back on 7 October; off again 56 days later on 2 December: linked.
        spell("second", "2026-12-02", "2026-12-02", 50000),
        // 57 days after 2 December: a new period with its own earnings.
        spell("third", "2027-01-29", "2027-01-29", 50000),
      ],
      MON_FRI,
    );
    expect(spells.map((s) => [s.id, s.linked, s.periodStartId, s.weeklyPence])).toEqual([
      ["first", false, "first", 8000],
      ["second", true, "first", 8000],
      ["third", false, "third", 12325],
    ]);
  });

  it("stops after 28 weeks in a linked period", () => {
    // Off from Monday 5 October 2026 for 30 weeks.
    const { spells } = statutorySickPay([spell("long", "2026-10-05", "2027-05-02")], MON_FRI);
    expect(spells[0]).toMatchObject({ qualifyingDays: 150, paidDays: 140, weeksLeft: 0, exhaustedOn: "2027-04-19", fitNoteNeeded: true });
  });

  it("leaves sickness that began before 6 April 2026 to the old rules, including spells linked to it", () => {
    const { spells } = statutorySickPay([spell("old", "2026-04-01", "2026-04-08"), spell("later", "2026-05-01", "2026-05-01")], MON_FRI);
    expect(spells.map((s) => [s.oldRules, s.pence])).toEqual([
      [true, 0],
      [true, 0],
    ]);
  });

  it("totals SSP for a pay period from the days inside it", () => {
    // Thursday 1 to Wednesday 7 October: five qualifying days; September's pay period gets none.
    const { days } = statutorySickPay([spell("a", "2026-10-01", "2026-10-07")], MON_FRI);
    expect(sspInPeriod(days, "2026-10-01", "2026-10-31")).toBe(12325);
    expect(sspInPeriod(days, "2026-10-05", "2026-10-31")).toBe(Math.round((12325 * 3) / 5));
    expect(sspInPeriod(days, "2026-09-01", "2026-09-30")).toBe(0);
  });

  it("works out usual working days from shifts, or Monday to Friday with none", () => {
    expect(usualWorkingWeekdays(["2026-10-03", "2026-10-04", "2026-10-10"])).toEqual([0, 6]);
    expect(usualWorkingWeekdays([])).toEqual(MON_FRI);
  });
});
