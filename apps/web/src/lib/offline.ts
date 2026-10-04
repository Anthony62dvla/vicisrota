/**
 * Name of the cache holding the saved copy of a person's own page. Must match PAGE_CACHE in public/sw.js.
 * Cleared on sign out so the next person to use the phone never sees someone else's rota.
 */
export const PAGE_CACHE = "vr-pages-v1";

export const clearSavedPages = async () => {
  try {
    if ("caches" in window) await caches.delete(PAGE_CACHE);
  } catch {
    // Storage can be blocked (private browsing); there is then nothing saved to clear.
  }
};
