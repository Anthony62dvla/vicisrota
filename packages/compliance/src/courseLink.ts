/** The longest course address a manager can save. */
export const COURSE_URL_MAX = 300;

/**
 * Tidies a training course address a manager typed, such as "www.neurolearn.online". Adds https:// when it
 * is missing. Returns null for anything staff should not be sent to: not a web address, a javascript: or
 * file: link, or an address with a password in it.
 */
export function courseLink(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > COURSE_URL_MAX || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.toString();
}

/** A short name for a course link, such as "neurolearn.online", so staff can see where it goes before they tap. */
export const courseSite = (url: string) => new URL(url).hostname.replace(/^www\./, "");
