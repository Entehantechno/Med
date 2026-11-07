/* Safe wrappers around localStorage / sessionStorage.

   Browsers throw a SecurityError when storage is disabled (Safari private
   mode, "block all cookies", sandboxed iframes, some Android WebViews) and a
   QuotaExceededError when it is full. Before this helper the very first
   `localStorage.getItem("medlab_lang")` in AppProvider threw during render and
   the visitor saw a blank white page. Every access now degrades gracefully to
   an in-memory fallback so the site still works — settings just don't persist. */
const memLocal = new Map();
const memSession = new Map();

function area(kind) {
  try {
    const s = kind === "session" ? window.sessionStorage : window.localStorage;
    // Accessing the object can itself throw; touching a key proves it works.
    s.getItem("__medlab_probe__");
    return s;
  } catch { return null; }
}

function make(kind) {
  const mem = kind === "session" ? memSession : memLocal;
  return {
    getItem(k) {
      const s = area(kind);
      if (s) { try { return s.getItem(k); } catch { /* fall through */ } }
      return mem.has(k) ? mem.get(k) : null;
    },
    setItem(k, v) {
      const s = area(kind);
      if (s) { try { s.setItem(k, String(v)); return; } catch { /* quota / denied */ } }
      mem.set(k, String(v));
    },
    removeItem(k) {
      const s = area(kind);
      if (s) { try { s.removeItem(k); } catch { /* */ } }
      mem.delete(k);
    },
  };
}

export const safeLocal = make("local");
export const safeSession = make("session");
