/**
 * Display settings anyone can choose, signed in or not, kept in a cookie on their own device so
 * nothing about them is stored by the business. Applied to every page by the root layout.
 */
export const DISPLAY_COOKIE = "vr-display";

export const DISPLAY_OPTIONS = [
  { key: "large", label: "Larger text", hint: "Makes all text and buttons bigger." },
  { key: "readable", label: "Easier reading", hint: "A plainer font with more space between letters, words and lines, and no italics." },
  { key: "soft", label: "Softer colours", hint: "A cream background and gentler contrast, which some people find easier on the eyes." },
  { key: "still", label: "No movement", hint: "Turns off animation, and pages no longer refresh themselves while you are reading." },
] as const;

export type DisplayKey = (typeof DISPLAY_OPTIONS)[number]["key"];
const KEYS = new Set<string>(DISPLAY_OPTIONS.map((o) => o.key));

export const parseDisplay = (raw: string | undefined): DisplayKey[] =>
  (raw ?? "").split(".").filter((k): k is DisplayKey => KEYS.has(k));

export const serialiseDisplay = (keys: string[]) => keys.filter((k) => KEYS.has(k)).sort().join(".");
