export const STATEMENT_LEGAL_REF = "Employment Rights Act 1996, ss 1 to 7B (a written statement on or before the first day of work, for employees and workers)";

export const PAY_INTERVALS = ["weekly", "fortnightly", "four-weekly", "monthly"] as const;
export type PayInterval = (typeof PAY_INTERVALS)[number];

/** The business's own terms, the same for everyone. Each has a sensible default a business can change. */
export interface StatementTerms {
  payInterval?: PayInterval;
  bankHolidays?: string;
  sickPay?: string;
  otherPaidLeave?: string;
  benefits?: string;
  noticeFromEmployer?: string;
  noticeFromWorker?: string;
  probation?: string;
  training?: string;
  pension?: string;
  disciplinaryAndGrievance?: string;
  collectiveAgreements?: string;
}

export const STATEMENT_DEFAULTS: Required<Omit<StatementTerms, "payInterval">> & { payInterval: PayInterval } = {
  payInterval: "monthly",
  bankHolidays: "Bank holidays are part of your yearly holiday, not extra to it. If you work on a bank holiday, you take the day off another time.",
  sickPay: "Statutory Sick Pay, if you qualify. There is no extra company sick pay.",
  otherPaidLeave: "Maternity, paternity, adoption, shared parental, neonatal care and parental bereavement leave and pay, as the law sets out.",
  benefits: "None.",
  noticeFromEmployer:
    "At least 1 week once you have worked here for a month. Once you have worked here for 2 years, 1 week for each full year worked, up to 12 weeks.",
  noticeFromWorker: "At least 1 week once you have worked here for a month.",
  probation: "None.",
  training: "Any training your role needs is shown in VicisRota. Required training is paid as working time.",
  pension: "You will be put into a workplace pension if you are eligible, under automatic enrolment.",
  disciplinaryAndGrievance:
    "Our disciplinary and grievance procedures follow the Acas Code of Practice. Ask your manager for a copy. If you have a concern about your work, talk to your manager, or raise it in writing.",
  collectiveAgreements: "None.",
};

/** What is specific to one person, filled in by the manager when giving the statement. */
export interface StatementPerson {
  employerName: string;
  workerName: string;
  jobTitle: string;
  startDate: string | null;
  /** When continuous employment began, if earlier than the start date (for example after a transfer). */
  continuousFrom?: string | null;
  /** In the manager's words, for example "37.5 hours a week, Monday to Friday" or "Variable, shown on the rota". */
  hours: string;
  placeOfWork: string;
  /** Fixed-term or temporary work only. */
  temporaryUntil?: string | null;
  hourlyPence: number | null;
  irregularHours: boolean;
  daysPerWeek: number;
  leaveYearStartMonth: number;
}

export interface StatementSection {
  heading: string;
  text: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** What still needs filling in before a statement can be given. */
export const missingParticulars = (p: StatementPerson): string[] => [
  ...(!p.jobTitle.trim() ? ["job title"] : []),
  ...(!p.startDate ? ["start date"] : []),
  ...(!p.hours.trim() ? ["working hours"] : []),
  ...(!p.placeOfWork.trim() ? ["place of work"] : []),
  ...(p.hourlyPence == null ? ["pay rate"] : []),
];

/** The statement itself, section by section, in plain words. */
export const writtenStatement = (p: StatementPerson, terms: StatementTerms): StatementSection[] => {
  const t = { ...STATEMENT_DEFAULTS, ...Object.fromEntries(Object.entries(terms).filter(([, v]) => v != null && String(v).trim() !== "")) };
  const days = Math.min(28, Math.round(5.6 * p.daysPerWeek * 10) / 10);
  return [
    { heading: "Who this is between", text: `${p.employerName} (your employer) and ${p.workerName} (you).` },
    {
      heading: "Your job",
      text: `${p.jobTitle}.${p.temporaryUntil ? ` This is temporary work, expected to end on ${longDate(p.temporaryUntil)}.` : ""}`,
    },
    {
      heading: "When your work started",
      text: p.startDate
        ? `${longDate(p.startDate)}.${p.continuousFrom && p.continuousFrom < p.startDate ? ` Your continuous employment began on ${longDate(p.continuousFrom)}.` : ""}`
        : "To be confirmed.",
    },
    { heading: "Where you work", text: p.placeOfWork },
    { heading: "Your hours", text: `${p.hours} Your shifts are shown in VicisRota, including any breaks.` },
    {
      heading: "Your pay",
      text: `${p.hourlyPence == null ? "To be confirmed" : `${pounds(p.hourlyPence)} an hour`}, before tax and National Insurance, paid ${t.payInterval}. You will get a payslip each time you are paid.`,
    },
    {
      heading: "Your holiday",
      text: p.irregularHours
        ? `You build up holiday at 12.07% of the hours you work. The holiday year starts on 1 ${MONTHS[p.leaveYearStartMonth - 1]}. ${t.bankHolidays} Holiday pay is a week's pay, worked out from the average of the last 52 weeks you were paid.`
        : `${fmt(days)} days a year (5.6 weeks), including bank holidays unless stated below. The holiday year starts on 1 ${MONTHS[p.leaveYearStartMonth - 1]}. ${t.bankHolidays} Holiday pay is a week's pay, worked out from the average of the last 52 weeks you were paid.`,
    },
    { heading: "If you are ill", text: t.sickPay },
    { heading: "Other paid leave", text: t.otherPaidLeave },
    { heading: "Other benefits", text: t.benefits },
    { heading: "Probation", text: t.probation },
    { heading: "Training", text: t.training },
    { heading: "Notice", text: `From us: ${t.noticeFromEmployer} From you: ${t.noticeFromWorker}` },
    { heading: "Pension", text: t.pension },
    { heading: "Disciplinary and grievance procedures", text: t.disciplinaryAndGrievance },
    { heading: "Collective agreements", text: t.collectiveAgreements },
  ];
};
