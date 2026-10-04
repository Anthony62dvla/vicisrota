import { describe, expect, it } from "vitest";
import { capturePattern, expandPattern } from "../src/patterns";
import { londonDateTime, londonParts } from "../src/time";

const at = (date: string, time: string) => londonDateTime(date, time);
const local = (ms: number) => {
  const p = londonParts(ms);
  return `${p.date} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

describe("rota patterns", () => {
  // Two-week rotating pattern from Monday 5 October 2026: Jo days in week 1, nights in week 2.
  const shifts = [
    { start: at("2026-10-05", "08:00"), end: at("2026-10-05", "16:00"), breaks: [{ start: at("2026-10-05", "12:00"), end: at("2026-10-05", "12:30") }], details: "jo-day" },
    { start: at("2026-10-14", "22:00"), end: at("2026-10-15", "08:00"), breaks: [], details: "jo-night" },
    { start: at("2026-10-19", "09:00"), end: at("2026-10-19", "17:00"), breaks: [], details: "outside" },
  ];
  const slots = capturePattern(shifts, "2026-10-07", 2);

  it("keeps wall-clock times, the week and day, breaks, and ignores shifts outside the weeks", () => {
    expect(slots).toEqual([
      { weekIndex: 0, weekday: 0, startTime: "08:00", endTime: "16:00", endsNextDay: false, breaks: [{ offsetMinutes: 240, minutes: 30 }], details: "jo-day" },
      { weekIndex: 1, weekday: 2, startTime: "22:00", endTime: "08:00", endsNextDay: true, breaks: [], details: "jo-night" },
    ]);
  });

  it("repeats the weeks in order, and can start part way through the rotation", () => {
    const filled = expandPattern(slots, 2, "2026-11-02", 3);
    expect(filled.map((s) => `${s.details} ${local(s.start)}`)).toEqual(["jo-day 2026-11-02 08:00", "jo-night 2026-11-11 22:00", "jo-day 2026-11-16 08:00"]);
    const offset = expandPattern(slots, 2, "2026-11-02", 1, 1);
    expect(offset.map((s) => s.details)).toEqual(["jo-night"]);
  });

  it("gives the same clock times across the clocks going back", () => {
    // 25 October 2026: a night shift from Saturday 24th runs through the change.
    const [night] = expandPattern([{ ...slots[1]!, weekday: 5 }], 2, "2026-10-19", 1, 1);
    expect(local(night!.start)).toBe("2026-10-24 22:00");
    expect(local(night!.end)).toBe("2026-10-25 08:00");
    expect((night!.end - night!.start) / 3_600_000).toBe(11);
    const [day] = expandPattern(slots, 2, "2026-10-26", 1);
    expect(local(day!.start)).toBe("2026-10-26 08:00");
    expect(local(day!.breaks[0]!.start)).toBe("2026-10-26 12:00");
  });
});
