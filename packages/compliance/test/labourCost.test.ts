import { describe, expect, it } from "vitest";
import { labourPercent, onCostsFor } from "../src/index";

const week = "2026-10-12";

describe("labour cost on top of wages", () => {
  it("adds employer National Insurance above £96 a week, pension and holiday", () => {
    // £400 a week, aged 30: NI 15% of £304 = £45.60; pension 3% of £280 = £8.40; holiday 12.07% = £48.28.
    expect(onCostsFor([{ wagesPence: 40_000, dateOfBirth: "1996-01-01", apprentice: false }], week)).toEqual({
      nationalInsurancePence: 4_560,
      pensionPence: 840,
      holidayPence: 4_828,
      totalPence: 10_228,
    });
  });

  it("charges no National Insurance for under-21s, and no pension under 22 or on low pay", () => {
    const young = onCostsFor([{ wagesPence: 40_000, dateOfBirth: "2007-01-01", apprentice: false }], week);
    expect(young.nationalInsurancePence).toBe(0);
    expect(young.pensionPence).toBe(0);
    const low = onCostsFor([{ wagesPence: 15_000, dateOfBirth: "1990-01-01", apprentice: false }], week);
    expect(low.pensionPence).toBe(0);
    expect(low.nationalInsurancePence).toBe(810);
  });

  it("gives apprentices under 25 the same National Insurance relief", () => {
    expect(onCostsFor([{ wagesPence: 40_000, dateOfBirth: "2003-01-01", apprentice: true }], week).nationalInsurancePence).toBe(0);
    expect(onCostsFor([{ wagesPence: 40_000, dateOfBirth: "2003-01-01", apprentice: false }], week).nationalInsurancePence).toBe(4_560);
  });

  it("shows wages as a share of sales", () => {
    expect(labourPercent(30_000, 100_000)).toBe(30);
    expect(labourPercent(1, 3)).toBe(33.3);
    expect(labourPercent(30_000, 0)).toBeNull();
    expect(labourPercent(30_000, null)).toBeNull();
  });
});
