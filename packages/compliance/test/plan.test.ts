import { describe, expect, it } from "vitest";
import { BANDS, bandFor, bandPrice, canAddPerson, planState } from "../src";

const now = new Date("2026-11-01T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("prices", () => {
  it("charges nothing up to five people", () => {
    expect(bandFor(0)).toBe("free");
    expect(bandFor(5)).toBe("free");
  });

  it("puts each team in the smallest band it fits", () => {
    expect(bandFor(6)).toMatchObject({ upTo: 15, monthPence: 2900 });
    expect(bandFor(15)).toMatchObject({ upTo: 15 });
    expect(bandFor(16)).toMatchObject({ upTo: 30, monthPence: 4900 });
    expect(bandFor(60)).toMatchObject({ upTo: 60, monthPence: 8900 });
    expect(bandFor(100)).toMatchObject({ upTo: 100, monthPence: 13900 });
    expect(bandFor(101)).toBe("large");
  });

  it("charges ten months for a year and halves the price for charities", () => {
    const band = BANDS[0];
    expect(bandPrice(band)).toBe(2900);
    expect(bandPrice(band, { interval: "year" })).toBe(29000);
    expect(bandPrice(band, { charity: true })).toBe(1450);
    expect(bandPrice(band, { charity: true, interval: "year" })).toBe(14500);
  });

  it("never charges more per person in a bigger band", () => {
    const perHead = BANDS.map((b) => b.monthPence / b.upTo);
    expect([...perHead].sort((x, y) => y - x)).toEqual(perHead);
  });
});

describe("plan state", () => {
  it("keeps small teams free for good, trial or not", () => {
    expect(planState({ now, staff: 5, trialEndsAt: days(-100), subscription: null })).toEqual({ kind: "free", canPlan: true });
  });

  it("lets a bigger team plan during the trial and counts the days left", () => {
    expect(planState({ now, staff: 12, trialEndsAt: days(10), subscription: null })).toEqual({ kind: "trial", canPlan: true, daysLeft: 10 });
  });

  it("pauses planning for a bigger team once the trial ends without a plan", () => {
    expect(planState({ now, staff: 12, trialEndsAt: days(-1), subscription: null })).toEqual({ kind: "paused", canPlan: false, why: "trial-ended" });
  });

  it("lets a paying team plan", () => {
    expect(planState({ now, staff: 40, trialEndsAt: null, subscription: { status: "active", pastDueSince: null } }).canPlan).toBe(true);
  });

  it("gives fourteen days after a failed payment before pausing", () => {
    const late = planState({ now, staff: 40, trialEndsAt: null, subscription: { status: "past_due", pastDueSince: days(-4) } });
    expect(late).toEqual({ kind: "late", canPlan: true, daysLeft: 10 });
    const paused = planState({ now, staff: 40, trialEndsAt: null, subscription: { status: "past_due", pastDueSince: days(-15) } });
    expect(paused).toEqual({ kind: "paused", canPlan: false, why: "payment-failed" });
  });

  it("falls back to the free plan when a cancelled team is back down to five", () => {
    expect(planState({ now, staff: 4, trialEndsAt: null, subscription: { status: "canceled", pastDueSince: null } }).kind).toBe("free");
    expect(planState({ now, staff: 9, trialEndsAt: null, subscription: { status: "canceled", pastDueSince: null } })).toMatchObject({ why: "cancelled" });
  });
});

describe("adding people", () => {
  it("stops a free team adding a sixth person once its trial is over", () => {
    expect(canAddPerson({ now, staff: 4, trialEndsAt: days(-1), subscription: null })).toBe(true);
    expect(canAddPerson({ now, staff: 5, trialEndsAt: days(-1), subscription: null })).toBe(false);
  });

  it("lets a team in its trial or on a plan add people", () => {
    expect(canAddPerson({ now, staff: 5, trialEndsAt: days(3), subscription: null })).toBe(true);
    expect(canAddPerson({ now, staff: 30, trialEndsAt: null, subscription: { status: "active", pastDueSince: null } })).toBe(true);
  });
});
