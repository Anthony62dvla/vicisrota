/** A same-site path to go to after signing in, or null. Rejects full URLs and "//host" tricks. */
export const safeNextPath = (value: string | null | undefined): string | null =>
  value && /^\/(?![/\\])[\w\-./?=&%]*$/.test(value) ? value : null;
