import { describe, expect, it } from "vitest";
import { addDays, agencyProgress } from "../src/index";

// Started on a Wednesday: weeks run Wednesday to Tuesday.
const start = "2026-06-03";
const everyWeek = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => addDays(start, 7 * (from + i) + 2));

describe("agency worker 12-week qualifying period", () => {
  it("counts weeks from the assignment start and gives the date equal treatment starts", () => {
    const p = agencyProgress({ startedOn: start, workedOn: everyWeek(0, 12), leave: [], asOf: "2026-09-30" });
    expect(p).toMatchObject({ weeks: 12, qualifiedOn: "2026-08-26", restartedOn: null });
  });

  it("forecasts the date if they keep working every week", () => {
    const p = agencyProgress({ startedOn: start, workedOn: everyWeek(0, 4), leave: [], asOf: "2026-06-30" });
    expect(p.weeks).toBe(4);
    expect(p.qualifiedOn).toBeNull();
    expect(p.expectedOn).toBe("2026-08-26");
  });

  it("pauses for a break of up to 6 weeks, and starts again after a longer one", () => {
    const short = agencyProgress({ startedOn: start, workedOn: [...everyWeek(0, 6), ...everyWeek(12, 18)], leave: [], asOf: "2026-10-13" });
    expect(short.weeks).toBe(12);
    const long = agencyProgress({ startedOn: start, workedOn: [...everyWeek(0, 6), ...everyWeek(13, 15)], leave: [], asOf: "2026-09-15" });
    expect(long.weeks).toBe(2);
    expect(long.restartedOn).toBe(addDays(start, 7 * 13));
  });

  it("pauses for sickness, and counts maternity leave as qualifying weeks", () => {
    const sick = agencyProgress({
      startedOn: start,
      workedOn: [...everyWeek(0, 5), ...everyWeek(15, 17)],
      leave: [{ kind: "sick", startsOn: addDays(start, 35), endsOn: addDays(start, 104) }],
      asOf: addDays(start, 7 * 17 - 1),
    });
    expect(sick.weeks).toBe(7);
    const maternity = agencyProgress({ startedOn: start, workedOn: everyWeek(0, 5), leave: [{ kind: "maternity", startsOn: addDays(start, 35), endsOn: addDays(start, 83) }], asOf: addDays(start, 83) });
    expect(maternity.weeks).toBe(12);
  });
});
