import { describe, expect, it } from "vitest";
import { FAMILY_LEAVE, familyLeaveNotes, isFamilyLeave } from "../src";
import { noShiftDuringLeave } from "../src/rules/leave";

describe("family leave", () => {
  it("knows which kinds are family leave", () => {
    expect(isFamilyLeave("maternity")).toBe(true);
    expect(isFamilyLeave("carers")).toBe(true);
    expect(isFamilyLeave("annual")).toBe(false);
    expect(FAMILY_LEAVE.shared_parental.keepingInTouchDays).toBe(20);
  });

  it("notes leave longer than the legal minimum, without blocking", () => {
    expect(familyLeaveNotes({ kind: "paternity", startsOn: "2026-11-02", endsOn: "2026-11-15" })).toEqual([]);
    const notes = familyLeaveNotes({ kind: "paternity", startsOn: "2026-11-02", endsOn: "2026-11-20" });
    expect(notes[0]).toContain("up to 2 weeks by law, and this is 19 days");
  });

  it("adds up carer's leave over 12 months", () => {
    const earlier = [{ kind: "carers" as const, startsOn: "2026-03-02", endsOn: "2026-03-05" }];
    expect(familyLeaveNotes({ kind: "carers", startsOn: "2026-10-05", endsOn: "2026-10-07" }, earlier)).toEqual([]);
    expect(familyLeaveNotes({ kind: "carers", startsOn: "2026-10-05", endsOn: "2026-10-08" }, earlier)[0]).toContain("8 days in 12 months");
    // Leave more than a year ago does not count.
    expect(familyLeaveNotes({ kind: "carers", startsOn: "2027-10-05", endsOn: "2027-10-08" }, earlier)).toEqual([]);
  });

  it("warns when keeping in touch days go over the limit", () => {
    expect(familyLeaveNotes({ kind: "maternity", startsOn: "2026-01-05", endsOn: "2026-12-20" }, [], 10)).toEqual([]);
    expect(familyLeaveNotes({ kind: "maternity", startsOn: "2026-01-05", endsOn: "2026-12-20" }, [], 11)[0]).toContain("more than the 10 allowed");
  });

  it("lets a shift go ahead on an agreed keeping in touch day", () => {
    const ctx = {
      asOf: "2026-06-01",
      workers: [{ id: "w", name: "Asha", dateOfBirth: "1990-01-01" }],
      shifts: [
        { id: "kit", workerId: "w", start: "2026-06-03T08:00:00Z", end: "2026-06-03T14:00:00Z", breaks: [] },
        { id: "other", workerId: "w", start: "2026-06-04T08:00:00Z", end: "2026-06-04T14:00:00Z", breaks: [] },
      ],
      leave: [{ workerId: "w", kind: "maternity" as const, status: "approved" as const, startsOn: "2026-03-01", endsOn: "2026-12-31", workDays: ["2026-06-03"] }],
    };
    const findings = noShiftDuringLeave.check(ctx as never);
    expect(findings.map((f) => f.shiftIds[0])).toEqual(["other"]);
    expect(findings[0]!.message).toContain("maternity leave");
  });
});
