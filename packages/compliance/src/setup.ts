/**
 * Guided setup: the steps a new business works through before its first rota, in a fixed order.
 * Each step is worked out from what the business has already recorded, so it ticks itself off
 * and never needs marking as done by hand. Steps the law expects come first; optional ones say so.
 */

export type BusinessSector = "care" | "hospitality" | "small_business";

export interface SetupFacts {
  sector: BusinessSector;
  requiresEnhancedDbs: boolean;
  staff: number;
  /** People with a right to work check recorded. */
  withRightToWork: number;
  /** People with a DBS check recorded. */
  withDbs: number;
  /** People who can sign in, or have an invitation that has not expired or been withdrawn. */
  invitedOrJoined: number;
  clients: number;
  hasTippingPolicy: boolean;
  workplaces: number;
  shifts: number;
  publishedShifts: number;
  alertContacts: number;
  /** The first person each staff step still needs doing for, so its link goes straight to them. */
  nextPerson?: Partial<Record<"right_to_work" | "dbs" | "invite", string>>;
}

export type SetupStepId =
  | "staff"
  | "right_to_work"
  | "dbs"
  | "clients"
  | "tipping_policy"
  | "rota"
  | "publish"
  | "invite"
  | "workplace"
  | "alert_contacts";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  /** Why it matters, in one plain sentence. */
  why: string;
  href: string;
  done: boolean;
  optional: boolean;
  /** How far along a step about everyone is, e.g. "2 of 5 people". */
  progress?: string | undefined;
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const ofStaff = (n: number, staff: number) => `${n} of ${people(staff)}`;
/** A step about every member of staff is done once there are staff and all of them are covered. */
const everyone = (n: number, staff: number) => staff > 0 && n >= staff;
/** Goes to the person's own page when there is one, at the part of it that needs doing. */
const personHref = (id: string | undefined, section: string) => (id ? `/staff/${id}#${section}` : "/staff");

export function setupSteps(f: SetupFacts): SetupStep[] {
  const steps: (SetupStep | false)[] = [
    {
      id: "staff",
      title: "Add your staff",
      why: "Dates of birth and pay rates let VicisRota check the minimum wage and the extra limits for under-18s.",
      href: "/staff",
      done: f.staff > 0,
      optional: false,
      progress: f.staff > 0 ? `${people(f.staff)} added` : undefined,
    },
    {
      id: "right_to_work",
      title: "Record right to work checks",
      why: "You must check everyone's right to work in the UK before they start (Immigration, Asylum and Nationality Act 2006).",
      href: personHref(f.nextPerson?.right_to_work, "right-to-work"),
      done: everyone(f.withRightToWork, f.staff),
      optional: false,
      progress: f.staff > 0 ? ofStaff(f.withRightToWork, f.staff) : undefined,
    },
    f.requiresEnhancedDbs && {
      id: "dbs",
      title: "Record DBS checks",
      why: "Care staff need an enhanced DBS check with a barred list check before working with people (CQC Regulation 19).",
      href: personHref(f.nextPerson?.dbs, "dbs"),
      done: everyone(f.withDbs, f.staff),
      optional: false,
      progress: f.staff > 0 ? ofStaff(f.withDbs, f.staff) : undefined,
    },
    f.sector === "care" && {
      id: "clients",
      title: "Add the people you visit",
      why: "Visits are planned against each person, with travel time between them counted for pay.",
      href: "/clients",
      done: f.clients > 0,
      optional: false,
    },
    f.sector === "hospitality" && {
      id: "tipping_policy",
      title: "Write your tipping policy",
      why: "If you take tips, staff have a right to read a written policy on how they are shared (Employment (Allocation of Tips) Act 2023).",
      href: "/tips",
      done: f.hasTippingPolicy,
      optional: false,
    },
    {
      id: "rota",
      title: "Plan your first week",
      why: "Add shifts as drafts. Nobody sees them until you publish.",
      href: "/rota",
      done: f.shifts > 0,
      optional: false,
    },
    {
      id: "publish",
      title: "Check and publish the rota",
      why: "VicisRota checks rest breaks, weekly hours, pay and staff checks first, and explains anything that needs fixing.",
      href: "/rota",
      done: f.publishedShifts > 0,
      optional: false,
    },
    {
      id: "invite",
      title: "Invite staff to sign in",
      why: "Staff can then see their own shifts, ask for time off, pick up shifts and clock in.",
      href: personHref(f.nextPerson?.invite, "login"),
      done: everyone(f.invitedOrJoined, f.staff),
      optional: true,
      progress: f.staff > 0 ? ofStaff(f.invitedOrJoined, f.staff) : undefined,
    },
    {
      id: "workplace",
      title: "Add your workplace",
      why: "Needed to check people clock in at work, or to set up a clock-in tablet.",
      href: "/workplaces",
      done: f.workplaces > 0,
      optional: true,
    },
    {
      id: "alert_contacts",
      title: "Choose who to text if a lone worker needs help",
      why: "If anyone works alone, someone should be told straight away when they ask for help or miss a check-in.",
      href: "/lone-working",
      done: f.alertContacts > 0,
      optional: true,
    },
  ];
  return steps.filter((s): s is SetupStep => s !== false);
}

/** Setup is finished once every step that is not optional is done. */
export const setupFinished = (steps: SetupStep[]) => steps.every((s) => s.done || s.optional);
