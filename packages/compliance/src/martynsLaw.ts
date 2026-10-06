export const MARTYNS_LAW_LEGAL_REF = "Terrorism (Protection of Premises) Act 2025 (Martyn's Law), ss 2 to 6 and Schedule 1; regulated by the Security Industry Authority";

/** The Act has a 24-month implementation period from Royal Assent on 3 April 2025, so it applies from April 2027 at the earliest. */
export const MARTYNS_LAW_EARLIEST = "2027-04-03";

export type MartynsLawTier = "none" | "standard" | "enhanced";

/** Standard duty: 200 to 799 people expected at the same time. Enhanced duty: 800 or more. */
export const martynsLawTier = (capacity: number | null | undefined): MartynsLawTier =>
  capacity == null || capacity < 200 ? "none" : capacity < 800 ? "standard" : "enhanced";

/** What each tier must do, in plain words. */
export const MARTYNS_LAW_DUTIES: Record<Exclude<MartynsLawTier, "none">, string[]> = {
  standard: [
    "Tell the Security Industry Authority about the premises.",
    "Have procedures for an attack, as far as reasonably practicable: getting people out (evacuation), bringing people in and keeping them safe (invacuation), locking down, and telling people what is happening.",
    "Make sure staff know the procedures and their part in them.",
  ],
  enhanced: [
    "Tell the Security Industry Authority about the premises.",
    "Have the standard procedures: evacuation, invacuation, lockdown and communication.",
    "Put in place public protection measures to reduce the risk of an attack and the harm it could cause, such as monitoring and controlling who comes in.",
    "Write a security plan, keep it up to date, and name a senior person responsible for it.",
    "Make sure staff know the procedures and measures, and their part in them.",
  ],
};

/** Procedures should be looked at again at least once a year. */
export const proceduresReviewDue = (reviewedOn: string | null | undefined, today: string) => {
  if (!reviewedOn) return true;
  const [y, m, d] = reviewedOn.split("-").map(Number) as [number, number, number];
  const due = new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10);
  return today >= due;
};
