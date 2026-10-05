import { describe, expect, it } from "vitest";
import { shortNoticePay } from "../src/index";

const at = (iso: string) => new Date(iso);
// Saturday 10 October 2026, 09:00 to 17:00 UK time (BST), with a 30 minute unpaid break.
const shift = { start: at("2026-10-10T08:00:00Z"), end: at("2026-10-10T16:00:00Z"), breakMinutes: 30 };
const rates = [{ workerId: "w", hourlyPence: 1200, effectiveFrom: "2026-04-01" }];
const base = { before: shift, noticeHours: 48, percent: 100, rates, shiftDate: "2026-10-10" };

describe("short-notice cancellation pay (Employment Rights Act 2025)", () => {
  it("pays the paid hours of a shift cancelled inside the notice period", () => {
    // Cancelled 24 hours before: 8 hours less a 30 minute break is 7.5 hours at £12.
    const pay = shortNoticePay({ ...base, after: null, changedAt: at("2026-10-09T08:00:00Z") });
    expect(pay).toEqual({ kind: "cancelled", lostMinutes: 450, noticeHours: 24, pence: 9000 });
  });

  it("owes nothing with enough notice, after the shift started, or when switched off", () => {
    expect(shortNoticePay({ ...base, after: null, changedAt: at("2026-10-08T08:00:00Z") })).toBeNull();
    expect(shortNoticePay({ ...base, after: null, changedAt: at("2026-10-10T09:00:00Z") })).toBeNull();
    expect(shortNoticePay({ ...base, noticeHours: null, after: null, changedAt: at("2026-10-09T08:00:00Z") })).toBeNull();
  });

  it("pays only the hours lost when a shift is cut short", () => {
    // Now finishes at 13:00 instead of 17:00: 4 of 8 hours lost, less a share of the break.
    const pay = shortNoticePay({ ...base, after: { start: shift.start, end: at("2026-10-10T12:00:00Z") }, changedAt: at("2026-10-09T20:00:00Z") });
    expect(pay).toMatchObject({ kind: "shortened", lostMinutes: 225, noticeHours: 12, pence: 4500 });
  });

  it("treats a shift moved to other times as lost time from the original", () => {
    const moved = shortNoticePay({
      ...base,
      after: { start: at("2026-10-11T08:00:00Z"), end: at("2026-10-11T16:00:00Z") },
      changedAt: at("2026-10-09T08:00:00Z"),
    });
    expect(moved).toMatchObject({ kind: "moved", lostMinutes: 450 });
    // Starting an hour later and finishing an hour later loses one hour of the original.
    const later = shortNoticePay({ ...base, after: { start: at("2026-10-10T09:00:00Z"), end: at("2026-10-10T17:00:00Z") }, changedAt: at("2026-10-09T08:00:00Z") });
    expect(later).toMatchObject({ kind: "moved", lostMinutes: 56 });
  });

  it("owes nothing when the shift only gets longer", () => {
    expect(shortNoticePay({ ...base, after: { start: shift.start, end: at("2026-10-10T18:00:00Z") }, changedAt: at("2026-10-09T08:00:00Z") })).toBeNull();
  });

  it("applies the business's chosen share and the rate in force on the day", () => {
    const pay = shortNoticePay({
      ...base,
      percent: 50,
      rates: [...rates, { workerId: "w", hourlyPence: 1400, effectiveFrom: "2026-10-10" }],
      after: null,
      changedAt: at("2026-10-09T08:00:00Z"),
    });
    expect(pay?.pence).toBe(5250);
  });
});
