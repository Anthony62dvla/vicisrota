/** The parts of a person's settings that say what they want to be told about, and how. */
export type MessageChoices = { textChanges?: boolean; remindEvening?: boolean; remindBeforeMinutes?: number | null; byText?: boolean };

/** Rota changes are on unless the person turned them off: on their page and as app notifications they cost nothing. */
export const tellsChanges = (p: MessageChoices) => p.textChanges ?? true;

/**
 * Whether the person also wants texts. Before app notifications, setting up any reminder meant texts,
 * so those people keep getting them until they choose otherwise.
 */
export const wantsTexts = (p: MessageChoices, mobile: string | null) => !!mobile && (p.byText ?? !!(p.textChanges || p.remindEvening || p.remindBeforeMinutes));

/** Quiet hours for team messages (see MessageQuiet in the database schema). Times are "HH:MM", UK time. */
export type QuietChoices = { from?: string | null; to?: string | null; daysOff?: boolean };
export const QUIET_DEFAULT = { from: "21:00", to: "07:00", daysOff: true } as const;

/**
 * Whether a message notification should wait. Nothing is lost: the message is there when they next
 * open VicisRota. offToday is true for staff with no shift that day.
 */
export const isQuiet = (q: QuietChoices, time: string, offToday: boolean) => {
  if ((q.daysOff ?? QUIET_DEFAULT.daysOff) && offToday) return true;
  const from = q.from === undefined ? QUIET_DEFAULT.from : q.from;
  const to = q.to === undefined ? QUIET_DEFAULT.to : q.to;
  if (!from || !to || from === to) return false;
  return from < to ? time >= from && time < to : time >= from || time < to;
};
