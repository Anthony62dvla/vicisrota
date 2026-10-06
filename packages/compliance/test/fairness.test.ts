import { describe, expect, it } from "vitest";
import { fairnessReport } from "../src";

const workers = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), dateOfBirth: "1990-01-01" }));
// 2026-10-10 is a Saturday, 2026-10-12 a Monday.
const day = (id: string, workerId: string, date: string) => ({ id, workerId, start: `${date}T08:00:00Z`, end: `${date}T16:00:00Z`, breaks: [] });
// 23:00 to 05:00 UK time (BST).
const night = (id: string, workerId: string, date: string, next: string) => ({ id, workerId, start: `${date}T22:00:00Z`, end: `${next}T04:00:00Z`, breaks: [] });

describe("fair allocation report", () => {
  it("counts weekends, nights, hours and short-notice changes for each person", () => {
    const [a] = fairnessReport({
      workers,
      shifts: [day("1", "a", "2026-10-10"), night("2", "a", "2026-10-12", "2026-10-13"), day("3", "b", "2026-10-12")],
      changes: [{ workerId: "a", noticeHours: 20 }, { workerId: "a", noticeHours: 400 }],
    });
    expect(a).toMatchObject({ shifts: 2, hours: 14, weekendShifts: 1, nightShifts: 1, shortNoticeChanges: 1, notes: [] });
  });

  it("notes someone with well over their share, compared with most of the team", () => {
    const shifts = [
      ...["2026-10-03", "2026-10-04", "2026-10-10", "2026-10-11"].map((d, i) => day(`a${i}`, "a", d)),
      day("b1", "b", "2026-10-10"),
      day("b2", "b", "2026-10-12"),
      day("c1", "c", "2026-10-11"),
    ];
    const lines = fairnessReport({ workers, shifts, changes: [] });
    expect(lines.find((l) => l.workerId === "a")!.notes).toEqual(["More weekend shifts than most of the team (most have 1)."]);
    expect(lines.find((l) => l.workerId === "b")!.notes).toEqual([]);
  });
});
