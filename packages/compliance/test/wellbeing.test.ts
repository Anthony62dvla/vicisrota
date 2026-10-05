import { describe, expect, it } from "vitest";
import { checkInDue, isHardShift } from "../src";

const shift = (start: string, end: string) => ({ id: "s", workerId: "w", start, end });
const day = shift("2026-10-05T08:00:00+01:00", "2026-10-05T16:00:00+01:00");
const long = shift("2026-10-05T08:00:00+01:00", "2026-10-05T18:30:00+01:00");
const night = shift("2026-10-05T22:00:00+01:00", "2026-10-06T07:00:00+01:00");
const after = (s: { end: string }, hours: number) => Date.parse(s.end) + hours * 3_600_000;

describe("wellbeing check-ins", () => {
  it("count long shifts and nights as hard", () => {
    expect(isHardShift(day)).toBe(false);
    expect(isHardShift(long)).toBe(true);
    expect(isHardShift(night)).toBe(true);
  });
  it("are only offered to people who turned them on", () => {
    expect(checkInDue({}, long, after(long, 1))).toBe(false);
    expect(checkInDue({ on: true }, long, after(long, 1))).toBe(true);
  });
  it("follow the person's choice of every shift or hard shifts only", () => {
    expect(checkInDue({ on: true, after: "hard" }, day, after(day, 1))).toBe(false);
    expect(checkInDue({ on: true, after: "every" }, day, after(day, 1))).toBe(true);
  });
  it("wait for the shift to end and go away after a day", () => {
    expect(checkInDue({ on: true }, long, after(long, -1))).toBe(false);
    expect(checkInDue({ on: true }, long, after(long, 23))).toBe(true);
    expect(checkInDue({ on: true }, long, after(long, 25))).toBe(false);
  });
});
