import { describe, expect, it } from "vitest";
import { remindersDue } from "../src/reminders";
import { londonDateTime } from "../src/time";

const shift = { id: "s1", start: londonDateTime("2026-10-06", "08:00") };
const kinds = (choice: Parameters<typeof remindersDue>[0], now: number) => remindersDue(choice, shift, now).map((r) => r.kind);

describe("remindersDue", () => {
  it("sends the evening reminder between 18:00 and 21:00 the day before, UK time", () => {
    expect(kinds({ evening: true }, londonDateTime("2026-10-05", "17:55"))).toEqual([]);
    expect(remindersDue({ evening: true }, shift, londonDateTime("2026-10-05", "18:05"))).toEqual([{ kind: "evening", key: "remind-evening:s1" }]);
    expect(kinds({ evening: true }, londonDateTime("2026-10-05", "21:00"))).toEqual([]);
  });

  it("sends the before reminder at the chosen time, and not much later", () => {
    expect(kinds({ beforeMinutes: 60 }, londonDateTime("2026-10-06", "06:55"))).toEqual([]);
    expect(remindersDue({ beforeMinutes: 60 }, shift, londonDateTime("2026-10-06", "07:02"))).toEqual([{ kind: "before", key: "remind-60:s1" }]);
    expect(kinds({ beforeMinutes: 60 }, londonDateTime("2026-10-06", "07:31"))).toEqual([]);
  });

  it("sends nothing unless chosen, once the shift has started, or for a time that is not offered", () => {
    expect(kinds({}, londonDateTime("2026-10-05", "18:05"))).toEqual([]);
    expect(kinds({ beforeMinutes: 60, evening: true }, shift.start)).toEqual([]);
    expect(kinds({ beforeMinutes: 7 }, shift.start - 7 * 60_000)).toEqual([]);
  });

  it("follows the clocks changing", () => {
    // The clocks go back on 25 October 2026, so 18:00 on the 24th is 17:00 UTC.
    const s = { id: "s2", start: londonDateTime("2026-10-25", "09:00") };
    expect(remindersDue({ evening: true }, s, Date.UTC(2026, 9, 24, 17, 5))).toHaveLength(1);
    expect(remindersDue({ evening: true }, s, Date.UTC(2026, 9, 24, 16, 55))).toHaveLength(0);
  });
});
