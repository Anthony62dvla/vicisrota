export const SLEEP_IN_LEGAL_REF =
  "National Minimum Wage Regulations 2015, reg. 32 (time a worker is permitted to sleep); Royal Mencap Society v Tomlinson-Blake [2021] UKSC 8.";

/** The kinds of shift a care provider can put on the rota. Waking nights are paid by the hour like any other shift. */
export const SHIFT_KINDS = ["standard", "sleep_in", "waking_night"] as const;
export type ShiftKind = (typeof SHIFT_KINDS)[number];

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  standard: "Standard shift",
  sleep_in: "Sleep-in",
  waking_night: "Waking night",
};
