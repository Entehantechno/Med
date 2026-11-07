/* build-check — is this page running the build the server now serves?
   Used by sw-update.js on controllerchange (see there). Kept in its own module
   so the entry bundle does not grow. */
/* R94: the page is only stale if the build it loaded is not the one the server
   serves now. Compare the entry script hash of the loaded document with a fresh
   copy of the HTML. A document that was already fetched from the network is
   current, so reloading it again would boot the whole app twice (measured:
   a warm profile loaded "/" twice; a cleared profile loaded it once).
   Any failure answers "stale", which keeps the previous behaviour. */
const ENTRY_RE = /\/assets\/index-[^"'\s<>]+\.js/;
export async function isDocumentStale() {
  try {
    const loaded = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute("src") || "";
    const loadedEntry = loaded.match(ENTRY_RE)?.[0];
    if (!loadedEntry) return true;                       // dev server or unknown markup
    const res = await fetch(`/?build-check=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return true;
    const latestEntry = (await res.text()).match(ENTRY_RE)?.[0];
    if (!latestEntry) return true;
    return latestEntry !== loadedEntry;
  } catch {
    return true;
  }
}

