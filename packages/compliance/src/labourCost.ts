import { ageOn } from "./time";
import type { LocalDate } from "./types";

/**
 * Weekly thresholds for 2026/27, in pence. Employer National Insurance: 15% above the secondary threshold
 * (£5,000 a year), and nothing up to the upper threshold (£50,270 a year) for under-21s and apprentices under 25.
 * Workplace pension: at least 3% from the employer on qualifying earnings (£6,240 to £50,270 a year) for people
 * aged 22 or over earning more than £10,000 a year.
 */
export const LABOUR_COST_RATES = {
  niRate: 0.15,
  niThresholdPence: 9_600,
  niUpperPence: 96_700,
  pensionRate: 0.03,
  pensionLowerPence: 12_000,
  pensionUpperPence: 96_700,
  pensionTriggerPence: 19_200,
  /** 5.6 weeks of holiday for every 46.4 weeks worked. */
  holidayRate: 0.1207,
} as const;

export const LABOUR_COST_LEGAL_REF =
  "Employer National Insurance (Social Security Contributions and Benefits Act 1992), workplace pension automatic enrolment (Pensions Act 2008), holiday pay (Working Time Regulations 1998, reg 13 and 13A), 2026/27 thresholds";

export interface CostPerson {
  wagesPence: number;
  dateOfBirth: LocalDate;
  apprentice: boolean;
}

export interface OnCosts {
  nationalInsurancePence: number;
  pensionPence: number;
  holidayPence: number;
  totalPence: number;
}

/**
 * An estimate of what each person's week costs on top of their wages. It treats each week on its own and leaves out
 * the Employment Allowance and anyone who has opted out of the pension, so the real figure is often a little lower.
 */
export const onCostsFor = (people: CostPerson[], weekStart: LocalDate): OnCosts => {
  const r = LABOUR_COST_RATES;
  let ni = 0;
  let pension = 0;
  let holiday = 0;
  for (const p of people) {
    if (p.wagesPence <= 0) continue;
    const age = ageOn(p.dateOfBirth, weekStart);
    const relief = age < 21 || (p.apprentice && age < 25);
    const niFrom = relief ? r.niUpperPence : r.niThresholdPence;
    ni += Math.max(0, p.wagesPence - niFrom) * r.niRate;
    if (age >= 22 && p.wagesPence > r.pensionTriggerPence) pension += (Math.min(p.wagesPence, r.pensionUpperPence) - r.pensionLowerPence) * r.pensionRate;
    holiday += p.wagesPence * r.holidayRate;
  }
  const out = { nationalInsurancePence: Math.round(ni), pensionPence: Math.round(pension), holidayPence: Math.round(holiday) };
  return { ...out, totalPence: out.nationalInsurancePence + out.pensionPence + out.holidayPence };
};

/** Wages as a share of sales, as a whole percentage to one decimal place. Null when there are no sales to compare. */
export const labourPercent = (costPence: number, salesPence: number | null | undefined): number | null =>
  salesPence && salesPence > 0 ? Math.round((costPence / salesPence) * 1000) / 10 : null;
