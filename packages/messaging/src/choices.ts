/** The parts of a person's settings that say what they want to be told about, and how. */
export type MessageChoices = { textChanges?: boolean; remindEvening?: boolean; remindBeforeMinutes?: number | null; byText?: boolean };

/** Rota changes are on unless the person turned them off: on their page and as app notifications they cost nothing. */
export const tellsChanges = (p: MessageChoices) => p.textChanges ?? true;

/**
 * Whether the person also wants texts. Before app notifications, setting up any reminder meant texts,
 * so those people keep getting them until they choose otherwise.
 */
export const wantsTexts = (p: MessageChoices, mobile: string | null) => !!mobile && (p.byText ?? !!(p.textChanges || p.remindEvening || p.remindBeforeMinutes));
