// Plain labels for safeguarding concerns, safe to use in the browser.

export const CONCERN_CATEGORIES = ["abuse_or_neglect", "self_harm", "colleague_conduct", "health_and_safety", "other"] as const;
export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number];

export const CONCERN_LABEL: Record<ConcernCategory, string> = {
  abuse_or_neglect: "Someone may be being harmed, abused or neglected",
  self_harm: "Someone may hurt themselves",
  colleague_conduct: "How a colleague or manager is behaving",
  health_and_safety: "Something unsafe at work",
  other: "Something else",
};

export const CONCERN_STATUS_LABEL = { open: "New", in_progress: "Being looked into", referred: "Referred on", closed: "Closed" } as const;
export type ConcernStatus = keyof typeof CONCERN_STATUS_LABEL;

/** On an error, what was typed comes back so nobody has to write their concern twice. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };
