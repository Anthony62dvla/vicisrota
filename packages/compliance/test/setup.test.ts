import { describe, expect, it } from "vitest";
import { setupFinished, setupSteps, type SetupFacts } from "../src/index";

const blank: SetupFacts = {
  sector: "small_business",
  requiresEnhancedDbs: false,
  staff: 0,
  withRightToWork: 0,
  withDbs: 0,
  invitedOrJoined: 0,
  clients: 0,
  hasTippingPolicy: false,
  workplaces: 0,
  shifts: 0,
  publishedShifts: 0,
  alertContacts: 0,
};
const ids = (f: SetupFacts) => setupSteps(f).map((s) => s.id);

describe("guided setup", () => {
  it("shows only the steps that apply to each kind of business", () => {
    expect(ids(blank)).toEqual(["staff", "right_to_work", "rota", "publish", "invite", "workplace", "alert_contacts"]);
    expect(ids({ ...blank, sector: "care", requiresEnhancedDbs: true })).toEqual(expect.arrayContaining(["dbs", "clients"]));
    expect(ids({ ...blank, sector: "care", requiresEnhancedDbs: true })).not.toContain("tipping_policy");
    expect(ids({ ...blank, sector: "hospitality" })).toEqual(expect.arrayContaining(["tipping_policy"]));
    expect(ids({ ...blank, sector: "hospitality" })).not.toContain("dbs");
  });

  it("does not count steps about everyone as done before anyone is added", () => {
    const steps = setupSteps(blank);
    expect(steps.find((s) => s.id === "right_to_work")).toMatchObject({ done: false, progress: undefined, href: "/staff" });
    expect(setupFinished(steps)).toBe(false);
  });

  it("needs every person covered, and says how far along it is", () => {
    const steps = setupSteps({ ...blank, staff: 3, withRightToWork: 2, invitedOrJoined: 3, nextPerson: { right_to_work: "w3" } });
    expect(steps.find((s) => s.id === "invite")).toMatchObject({ done: true, progress: "3 of 3 people" });
    expect(steps.find((s) => s.id === "right_to_work")).toMatchObject({ done: false, progress: "2 of 3 people", href: "/staff/w3#right-to-work" });
    expect(steps.find((s) => s.id === "staff")).toMatchObject({ progress: "3 people added" });
  });

  it("is finished once every required step is done, whatever the optional ones say", () => {
    const ready = { ...blank, sector: "care" as const, requiresEnhancedDbs: true, staff: 1, withRightToWork: 1, withDbs: 1, clients: 2, shifts: 4, publishedShifts: 4 };
    expect(setupFinished(setupSteps(ready))).toBe(true);
    expect(setupFinished(setupSteps({ ...ready, withDbs: 0 }))).toBe(false);
    expect(setupSteps(ready).filter((s) => !s.done).every((s) => s.optional)).toBe(true);
  });
});
