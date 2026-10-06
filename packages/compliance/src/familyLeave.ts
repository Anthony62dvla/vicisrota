import { addDays } from "./time";
import type { Leave, LeaveKind, LocalDate } from "./types";

export type FamilyLeaveKind = "maternity" | "paternity" | "adoption" | "shared_parental" | "neonatal" | "parental" | "parental_bereavement" | "carers" | "dependants";

export const FAMILY_LEAVE_KINDS: FamilyLeaveKind[] = ["maternity", "paternity", "adoption", "shared_parental", "neonatal", "parental", "parental_bereavement", "carers", "dependants"];

export interface FamilyLeaveRule {
  label: string;
  /** The most it can last in one go, in weeks. Null: no fixed limit ("reasonable" time). */
  maxWeeks: number | null;
  /** Days the person may work during the leave without ending it (keeping in touch, or SPLIT, days). */
  keepingInTouchDays: number | null;
  /** What the person and their manager should know, in plain words. */
  explain: string;
  legalRef: string;
}

/**
 * The UK's family-related leave, each with its own rules. Pay (such as Statutory Maternity Pay) is worked
 * out by payroll, so it is only mentioned here.
 */
export const FAMILY_LEAVE: Record<FamilyLeaveKind, FamilyLeaveRule> = {
  maternity: {
    label: "Maternity leave",
    maxWeeks: 52,
    keepingInTouchDays: 10,
    explain:
      "Up to 52 weeks. Statutory Maternity Pay may be due for up to 39 weeks. Nobody may work in the 2 weeks after giving birth. Up to 10 keeping in touch days can be worked, if both agree.",
    legalRef: "Employment Rights Act 1996, ss 71 to 73; Maternity and Parental Leave etc. Regulations 1999, regs 7, 8 and 12A",
  },
  paternity: {
    label: "Paternity leave",
    maxWeeks: 2,
    keepingInTouchDays: null,
    explain: "1 or 2 weeks, taken as one block or two separate weeks, within 52 weeks of the birth or adoption. Statutory Paternity Pay may be due.",
    legalRef: "Employment Rights Act 1996, s 80A; Paternity and Adoption Leave Regulations 2002, as amended in 2024",
  },
  adoption: {
    label: "Adoption leave",
    maxWeeks: 52,
    keepingInTouchDays: 10,
    explain: "Up to 52 weeks. Statutory Adoption Pay may be due for up to 39 weeks. Up to 10 keeping in touch days can be worked, if both agree.",
    legalRef: "Employment Rights Act 1996, ss 75A and 75B; Paternity and Adoption Leave Regulations 2002, regs 18 and 21A",
  },
  shared_parental: {
    label: "Shared parental leave",
    maxWeeks: 50,
    keepingInTouchDays: 20,
    explain: "Parents can share up to 50 weeks between them in the first year. Up to 20 shared parental leave in touch (SPLIT) days can be worked, if both agree.",
    legalRef: "Employment Rights Act 1996, s 75E; Shared Parental Leave Regulations 2014, reg 37",
  },
  neonatal: {
    label: "Neonatal care leave",
    maxWeeks: 12,
    keepingInTouchDays: null,
    explain: "For parents of a baby in neonatal care for 7 days or more: up to 12 weeks, taken within 68 weeks of the birth. Statutory Neonatal Care Pay may be due.",
    legalRef: "Neonatal Care (Leave and Pay) Act 2023; Neonatal Care Leave Regulations 2024",
  },
  parental: {
    label: "Parental leave (unpaid)",
    maxWeeks: 4,
    keepingInTouchDays: null,
    explain: "Unpaid. Up to 18 weeks for each child before they turn 18, usually taken in whole weeks and at most 4 weeks a year for each child.",
    legalRef: "Employment Rights Act 1996, s 76; Maternity and Parental Leave etc. Regulations 1999, Part 3 and Schedule 2",
  },
  parental_bereavement: {
    label: "Parental bereavement leave",
    maxWeeks: 2,
    keepingInTouchDays: null,
    explain: "After the death of a child under 18, or a stillbirth after 24 weeks: 1 or 2 weeks, taken within 56 weeks. Statutory pay may be due. Please be gentle with any questions.",
    legalRef: "Employment Rights Act 1996, s 80EA; Parental Bereavement Leave Regulations 2020",
  },
  carers: {
    label: "Carer's leave (unpaid)",
    maxWeeks: 1,
    keepingInTouchDays: null,
    explain: "Unpaid. Up to 1 week in any 12 months to care for someone with a long-term care need. It can be taken as half or whole days. No evidence can be asked for.",
    legalRef: "Carer's Leave Act 2023; Carer's Leave Regulations 2024",
  },
  dependants: {
    label: "Time off for dependants (emergency)",
    maxWeeks: null,
    keepingInTouchDays: null,
    explain: "Reasonable unpaid time off to deal with an emergency involving someone who depends on them, such as a child's illness or a breakdown in care.",
    legalRef: "Employment Rights Act 1996, s 57A",
  },
};

export const isFamilyLeave = (kind: LeaveKind): kind is FamilyLeaveKind => (FAMILY_LEAVE_KINDS as string[]).includes(kind);

/**
 * Leave that does not count towards the 17-week average for the 48-hour limit, so the average is taken over
 * other weeks instead. "family" is the older single type, kept for leave booked before the split.
 */
export const REFERENCE_PERIOD_EXCLUDED: LeaveKind[] = ["annual", "sick", "family", "maternity", "paternity", "adoption", "parental", "shared_parental"];

const days = (from: LocalDate, to: LocalDate) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) n++;
  return n;
};

/**
 * Plain-language points for a manager to check before approving family leave: longer than the law
 * allows in one go, carer's leave over a week in 12 months, or too many keeping in touch days. They are
 * prompts, never blocks: some workplaces give more than the minimum.
 */
export const familyLeaveNotes = (leave: Pick<Leave, "kind" | "startsOn" | "endsOn">, others: Pick<Leave, "kind" | "startsOn" | "endsOn">[] = [], keepingInTouchUsed = 0): string[] => {
  if (!isFamilyLeave(leave.kind)) return [];
  const rule = FAMILY_LEAVE[leave.kind];
  const notes: string[] = [];
  const length = days(leave.startsOn, leave.endsOn);
  // Carer's leave is added up over 12 months below instead.
  if (rule.maxWeeks != null && leave.kind !== "carers" && length > rule.maxWeeks * 7)
    notes.push(`${rule.label} is up to ${rule.maxWeeks} week${rule.maxWeeks === 1 ? "" : "s"} by law, and this is ${length} days. That's fine if you are giving more than the minimum.`);
  if (leave.kind === "carers") {
    const yearAgo = addDays(leave.endsOn, -364);
    const earlier = others
      .filter((o) => o.kind === "carers" && o.endsOn >= yearAgo && o.startsOn <= leave.endsOn && !(o.startsOn === leave.startsOn && o.endsOn === leave.endsOn))
      .reduce((sum, o) => sum + days(o.startsOn < yearAgo ? yearAgo : o.startsOn, o.endsOn), 0);
    if (earlier + length > 7) notes.push(`This brings carer's leave to ${earlier + length} days in 12 months. The legal minimum is 1 week.`);
  }
  if (rule.keepingInTouchDays != null && keepingInTouchUsed > rule.keepingInTouchDays)
    notes.push(`${keepingInTouchUsed} keeping in touch days are recorded, more than the ${rule.keepingInTouchDays} allowed. Working more could end the leave early.`);
  return notes;
};
