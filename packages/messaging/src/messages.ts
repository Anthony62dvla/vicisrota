/** Two standard SMS segments. Longer messages cost more and can arrive split. */
export const SMS_MAX = 306;

/** Plain characters only: curly quotes and dashes can force the whole text into a costlier encoding. */
const plain = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const fit = (s: string) => (s.length <= SMS_MAX ? s : s.slice(0, SMS_MAX - 3) + "...");

export const helpAlert = (a: { business: string; person: string; at: string; where?: string | null; note?: string | null; link: string }) =>
  fit(
    plain(
      `URGENT ${a.business}: ${a.person} asked for help at ${a.at}${a.where ? ` (${a.where})` : ""}.` +
        `${a.note ? ` They said: "${a.note.slice(0, 120)}".` : ""} Contact them now. If you cannot reach them and are worried, call 999. ${a.link}`,
    ),
  );

export const overdueAlert = (a: { business: string; person: string; what: string; due: string; where?: string | null; link: string }) =>
  fit(
    plain(
      `${a.business}: ${a.person} ${a.what} (due ${a.due})${a.where ? `, ${a.where}` : ""}. Please check they are safe. If you cannot reach them and are worried, call 999. ${a.link}`,
    ),
  );

export const lateAlert = (a: { business: string; person: string; shift: string; where?: string | null; link: string }) =>
  fit(
    plain(
      `${a.business}: ${a.person} has not clocked in for their shift ${a.shift}${a.where ? ` (${a.where})` : ""}. Please check the shift is covered and they are OK. ${a.link}`,
    ),
  );

/** A reminder the person asked for. Kept to the facts they need, with nothing about who else is working. */
export const reminderText = (a: { business: string; when: string; detail?: string | null; note?: string | null; link: string }) => {
  const note = a.note ? plain(a.note).slice(0, 100) : "";
  return fit(
    plain(
      `Reminder from ${a.business}: your shift ${a.when}${a.detail ? `, ${a.detail}` : ""}.${note ? ` Note: ${note}${/[.!?]$/.test(note) ? "" : "."}` : ""} Details: ${a.link}`,
    ),
  );
};

export const inviteText = (a: { business: string; link: string; days: number }) =>
  fit(plain(`${a.business} has invited you to VicisRota to see your shifts and ask for time off. Set up your login here (works once, for ${a.days} days): ${a.link}`));

export type RotaChangeKind = "added" | "changed" | "cancelled" | "given_to_you" | "taken_by_colleague";
const CHANGE_LABEL: Record<RotaChangeKind, string> = {
  added: "New shift",
  changed: "Changed, now",
  cancelled: "Cancelled",
  given_to_you: "Now yours",
  taken_by_colleague: "Covered by a colleague",
};

/**
 * One text per person per change to their rota. Lists up to three changes plainly, one per line,
 * then says how many more there are, so the text never gets cut off part way through a shift.
 */
export const rotaChangeText = (a: { business: string; changes: { kind: RotaChangeKind; when: string }[]; link: string }) => {
  const shown = a.changes.slice(0, 3).map((c) => `${CHANGE_LABEL[c.kind]}: ${c.when}`);
  const more = a.changes.length - shown.length;
  const lines = [`${a.business}: your rota has changed.`, ...shown, ...(more > 0 ? [`and ${more} more.`] : []), `See your shifts: ${a.link}`];
  // Newlines are kept: they make a list far easier to read on a phone.
  return fit(lines.map(plain).join("\n"));
};

/** The app notification version of rotaChangeText: no link, because tapping it opens their shifts. */
export const rotaChangeNotice = (a: { business: string; changes: { kind: RotaChangeKind; when: string }[] }) => {
  const shown = a.changes.slice(0, 3).map((c) => `${CHANGE_LABEL[c.kind]}: ${c.when}`);
  const more = a.changes.length - shown.length;
  return { title: `${a.business}: your rota has changed`, body: [...shown, ...(more > 0 ? [`and ${more} more.`] : [])].map(plain).join("\n") };
};

/** The app notification version of reminderText. */
export const reminderNotice = (a: { business: string; when: string; detail?: string | null; note?: string | null }) => {
  const note = a.note ? plain(a.note).slice(0, 100) : "";
  return {
    title: `${a.business}: shift reminder`,
    body: plain(`Your shift ${a.when}${a.detail ? `, ${a.detail}` : ""}.${note ? ` Note: ${note}${/[.!?]$/.test(note) ? "" : "."}` : ""}`),
  };
};
