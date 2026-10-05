import { describe, expect, it } from "vitest";
import { checksDue, needsAction, type DuePerson } from "../src";

const today = "2026-10-05";
const person = (p: Partial<DuePerson> = {}): DuePerson => ({
  id: "w1",
  name: "Ann",
  checks: [{ kind: "right_to_work", checkedOn: "2026-01-01", expiresOn: null, dbsLevel: null }],
  training: [],
  ...p,
});
const what = (people: DuePerson[], opts = {}) => checksDue(people, today, opts).map((i) => [i.what, i.state, i.dueOn]);

describe("checks due", () => {
  it("lists nothing for someone with an open-ended right to work and nothing that runs out", () => {
    expect(what([person()])).toEqual([]);
  });

  it("lists a missing right to work check", () => {
    expect(what([person({ checks: [] })])).toEqual([["Right to work check", "missing", null]]);
  });

  it("flags a time-limited right to work by its latest follow-up date", () => {
    const checks = [
      { kind: "right_to_work" as const, checkedOn: "2025-01-01", expiresOn: "2026-01-01", dbsLevel: null },
      { kind: "right_to_work" as const, checkedOn: "2026-01-01", expiresOn: "2026-10-20", dbsLevel: null },
    ];
    expect(what([person({ checks })])).toEqual([["Right to work follow-up", "soon", "2026-10-20"]]);
  });

  it("asks for an enhanced DBS with barred list only where care work needs it", () => {
    expect(what([person()])).toEqual([]);
    expect(what([person()], { requireEnhancedDbs: true })).toEqual([["Enhanced DBS with barred list", "missing", null]]);
  });

  it("uses the latest DBS for the recheck date, and names the Update Service", () => {
    const rtw = person().checks;
    const checks = [
      ...rtw,
      { kind: "dbs" as const, checkedOn: "2020-01-01", expiresOn: "2023-01-01", dbsLevel: "enhanced_barred" },
      { kind: "dbs" as const, checkedOn: "2023-02-01", expiresOn: "2026-09-30", dbsLevel: "enhanced_barred", updateService: true },
    ];
    expect(what([person({ checks })], { requireEnhancedDbs: true })).toEqual([["DBS Update Service check", "overdue", "2026-09-30"]]);
  });

  it("lists training and licences that run out, skipping any also held without an end date", () => {
    const training = [
      { name: "SIA licence", expiresOn: "2027-03-01" },
      { name: "First aid", expiresOn: "2025-01-01" },
      { name: "First aid", expiresOn: null },
    ];
    expect(what([person({ training })])).toEqual([["SIA licence", "later", "2027-03-01"]]);
  });

  it("lists the next supervision and appraisal from the latest one held", () => {
    const supervisions = [
      { kind: "supervision" as const, heldOn: "2026-08-01", nextDueOn: "2026-09-01" },
      { kind: "supervision" as const, heldOn: "2026-09-01", nextDueOn: "2026-10-01" },
      { kind: "appraisal" as const, heldOn: "2026-01-01", nextDueOn: "2027-01-01" },
    ];
    expect(what([person({ supervisions })])).toEqual([
      ["Supervision", "overdue", "2026-10-01"],
      ["Appraisal", "later", "2027-01-01"],
    ]);
  });

  it("puts missing first, then overdue, then soon, then later, and counts what needs doing", () => {
    const items = checksDue(
      [
        person({ id: "a", name: "Ann", training: [{ name: "SIA licence", expiresOn: "2026-10-05" }] }),
        person({ id: "b", name: "Ben", checks: [] }),
        person({ id: "c", name: "Cal", training: [{ name: "Food hygiene", expiresOn: "2026-10-04" }] }),
        person({ id: "d", name: "Dee", training: [{ name: "First aid", expiresOn: "2026-11-05" }] }),
      ],
      today,
    );
    expect(items.map((i) => `${i.workerName} ${i.state}`)).toEqual(["Ben missing", "Cal overdue", "Ann soon", "Dee later"]);
    expect(needsAction(items)).toHaveLength(3);
  });
});
