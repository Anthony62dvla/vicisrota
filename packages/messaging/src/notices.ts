import type { Lang } from "./languages";
import { plain, type RotaChangeKind } from "./messages";

/**
 * App notifications in the person's own language. Texts stay in English: other alphabets' letters
 * make every text cost two or three times as much.
 */
const WORDS = {
  en: {
    rotaChanged: (b: string) => `${b}: your rota has changed`,
    change: { added: "New shift", changed: "Changed, now", cancelled: "Cancelled", given_to_you: "Now yours", taken_by_colleague: "Covered by a colleague" },
    more: (n: number) => `and ${n} more.`,
    reminder: (b: string) => `${b}: shift reminder`,
    yourShift: "Your shift",
    note: "Note",
    today: "today",
    tomorrow: "tomorrow",
    checkIn: (b: string) => `${b}: how was your shift?`,
    checkInBody: "A quick, private check-in. Skip it if you like.",
  },
  cy: {
    rotaChanged: (b: string) => `${b}: mae eich rota wedi newid`,
    change: { added: "Shifft newydd", changed: "Wedi newid, nawr", cancelled: "Wedi'i chanslo", given_to_you: "Eich un chi nawr", taken_by_colleague: "Cydweithiwr sy'n ei gwneud" },
    more: (n: number) => `a ${n} arall.`,
    reminder: (b: string) => `${b}: nodyn atgoffa am eich shifft`,
    yourShift: "Eich shifft",
    note: "Nodyn",
    today: "heddiw",
    tomorrow: "yfory",
    checkIn: (b: string) => `${b}: sut aeth eich shifft?`,
    checkInBody: "Gwiriad cyflym a phreifat. Gallwch ei hepgor os hoffech chi.",
  },
  pl: {
    rotaChanged: (b: string) => `${b}: twój grafik się zmienił`,
    change: { added: "Nowa zmiana", changed: "Zmieniona, teraz", cancelled: "Odwołana", given_to_you: "Teraz twoja", taken_by_colleague: "Przejęta przez współpracownika" },
    more: (n: number) => `i jeszcze ${n}.`,
    reminder: (b: string) => `${b}: przypomnienie o zmianie`,
    yourShift: "Twoja zmiana",
    note: "Uwaga",
    today: "dzisiaj",
    tomorrow: "jutro",
    checkIn: (b: string) => `${b}: jak minęła twoja zmiana?`,
    checkInBody: "Krótkie, prywatne pytanie. Możesz je pominąć.",
  },
  ro: {
    rotaChanged: (b: string) => `${b}: programul tău s-a schimbat`,
    change: { added: "Tură nouă", changed: "Modificată, acum", cancelled: "Anulată", given_to_you: "Acum este a ta", taken_by_colleague: "Preluată de un coleg" },
    more: (n: number) => `și încă ${n}.`,
    reminder: (b: string) => `${b}: memento pentru tură`,
    yourShift: "Tura ta",
    note: "Notă",
    today: "azi",
    tomorrow: "mâine",
    checkIn: (b: string) => `${b}: cum a fost tura ta?`,
    checkInBody: "O verificare scurtă și privată. O poți sări dacă vrei.",
  },
} satisfies Record<Lang, unknown>;

/** The app notification version of rotaChangeText: no link, because tapping it opens their shifts. */
export const rotaChangeNotice = (a: { business: string; changes: { kind: RotaChangeKind; when: string }[] }, lang: Lang = "en") => {
  const w = WORDS[lang];
  const shown = a.changes.slice(0, 3).map((c) => `${w.change[c.kind]}: ${c.when}`);
  const more = a.changes.length - shown.length;
  return { title: w.rotaChanged(a.business), body: [...shown, ...(more > 0 ? [w.more(more)] : [])].map(plain).join("\n") };
};

/** The app notification version of reminderText. `when` is already in the person's language (see dayWord). */
export const reminderNotice = (a: { business: string; when: string; detail?: string | null; note?: string | null }, lang: Lang = "en") => {
  const w = WORDS[lang];
  const note = a.note ? plain(a.note).slice(0, 100) : "";
  return {
    title: w.reminder(a.business),
    body: plain(`${w.yourShift} ${a.when}${a.detail ? `, ${a.detail}` : ""}.${note ? ` ${w.note}: ${note}${/[.!?]$/.test(note) ? "" : "."}` : ""}`),
  };
};

/** "today" or "tomorrow" in the person's language. */
export const dayWord = (lang: Lang, isToday: boolean) => (isToday ? WORDS[lang].today : WORDS[lang].tomorrow);

/** The gentle after-shift wellbeing notification. */
export const checkInNotice = (business: string, lang: Lang = "en") => ({ title: WORDS[lang].checkIn(business), body: WORDS[lang].checkInBody });
