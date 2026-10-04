import { describe, expect, it } from "vitest";
import { attendance, clockSummary, lateAlertDue, type ClockEvent } from "../src/clock";

const MIN = 60_000;
const shift = { start: Date.UTC(2026, 9, 5, 8), end: Date.UTC(2026, 9, 5, 16) };
const at = (minutes: number) => shift.start + minutes * MIN;
const state = (events: ClockEvent[], now: number, onLeave = false) => attendance(clockSummary(events, shift, now), shift, now, onLeave);

describe("attendance", () => {
  it("is upcoming before the start and starting for the first few minutes", () => {
    expect(state([], at(-10)).state).toBe("upcoming");
    expect(state([], at(3))).toEqual({ state: "starting", minutesLate: 3 });
  });

  it("is late once the grace period passes, and missed if nobody clocks in by the end", () => {
    expect(state([], at(20))).toEqual({ state: "late", minutesLate: 20 });
    expect(state([], at(8 * 60 + 5))).toEqual({ state: "missed", minutesLate: 480 });
  });

  it("follows the clock once someone has clocked in, keeping how late they were", () => {
    expect(state([{ kind: "in", at: at(12) }], at(30))).toEqual({ state: "in", minutesLate: 12 });
    expect(state([{ kind: "in", at: at(0) }, { kind: "break_start", at: at(60) }], at(70)).state).toBe("on_break");
    expect(state([{ kind: "in", at: at(0) }, { kind: "out", at: at(480) }], at(500)).state).toBe("finished");
  });

  it("explains an empty clock with approved leave, but a clock-in still wins", () => {
    expect(state([], at(60), true).state).toBe("on_leave");
    expect(state([{ kind: "in", at: at(1) }], at(60), true).state).toBe("in");
  });
});

describe("lateAlertDue", () => {
  it("waits the chosen number of minutes", () => {
    expect(lateAlertDue(state([], at(10)).state, shift, at(10), 15)).toBe(false);
    expect(lateAlertDue(state([], at(15)).state, shift, at(15), 15)).toBe(true);
  });

  it("never alerts for someone who clocked in or is on leave", () => {
    expect(lateAlertDue(state([{ kind: "in", at: at(20) }], at(30)).state, shift, at(30), 15)).toBe(false);
    expect(lateAlertDue(state([], at(30), true).state, shift, at(30), 15)).toBe(false);
  });

  it("alerts at the end of a shift shorter than the wait, and not about long-finished shifts", () => {
    const short = { start: shift.start, end: shift.start + 20 * MIN };
    const s = (now: number) => attendance(clockSummary([], short, now), short, now).state;
    expect(lateAlertDue(s(short.start + 19 * MIN), short, short.start + 19 * MIN, 30)).toBe(false);
    expect(lateAlertDue(s(short.end), short, short.end, 30)).toBe(true);
    expect(lateAlertDue(s(short.end + 31 * MIN), short, short.end + 31 * MIN, 30)).toBe(false);
  });
});
