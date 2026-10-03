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
