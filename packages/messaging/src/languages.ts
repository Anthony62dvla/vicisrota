/**
 * The languages a person can choose for VicisRota. Each person picks their own; English is the default.
 * Translations are checked by native speakers before each language is switched on for everyone.
 */
export const LANGUAGES = [
  { code: "en", name: "English", own: "English", locale: "en-GB" },
  { code: "cy", name: "Welsh", own: "Cymraeg", locale: "cy-GB" },
  { code: "pl", name: "Polish", own: "Polski", locale: "pl-PL" },
  { code: "ro", name: "Romanian", own: "Română", locale: "ro-RO" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v);

/** The person's language, or English when they have not chosen one. */
export const langOf = (v: unknown): Lang => (isLang(v) ? v : "en");

/** The locale for dates, times and the read-aloud voice. */
export const localeOf = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)!.locale;
