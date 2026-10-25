import { useEffect, useState } from "react";

/* On-screen keyboard awareness (mobile).

   How browsers behave (default `interactive-widget=resizes-visual`, which is
   what Safari/iOS and Chrome on Android use):
   • the keyboard shrinks the VISUAL viewport (window.visualViewport.height)
     but NOT the layout viewport (window.innerHeight, 100dvh, position:fixed
     containers keep their full height);
   • so a full-screen fixed overlay can have its lower fields and submit
     button hidden behind the keyboard.

   This module reports the part of the layout viewport that is still visible
   above the keyboard, so overlays can size themselves to it.
   Pure helper + React hook; no DOM writes here. */

// Anything above this many px of hidden layout viewport is treated as a
// keyboard (ignores browser UI chrome changes such as the URL bar).
export const KEYBOARD_THRESHOLD_PX = 120;

/** @returns {{covered:boolean, top:number, height:number}} visible band of the layout viewport */
export function computeKeyboardInset(layoutHeight, vv) {
  const full = { covered: false, top: 0, height: Math.max(0, Math.round(layoutHeight || 0)) };
  if (!vv || !Number.isFinite(vv.height)) return full;
  const top = Math.max(0, Math.round(vv.offsetTop || 0));
  const height = Math.max(0, Math.round(vv.height));
  const hidden = Math.max(0, full.height - height - top);
  if (hidden <= KEYBOARD_THRESHOLD_PX) return full;
  return { covered: true, top, height };
}

function sameInset(a, b) {
  return a.covered === b.covered && a.top === b.top && a.height === b.height;
}

export function useKeyboardInset() {
  const [inset, setInset] = useState(() =>
    typeof window === "undefined"
      ? { covered: false, top: 0, height: 0 }
      : computeKeyboardInset(window.innerHeight, window.visualViewport),
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const vv = window.visualViewport;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = computeKeyboardInset(window.innerHeight, window.visualViewport);
        // Only re-render when the visible band really changed (scroll events are frequent).
        setInset((prev) => (sameInset(prev, next) ? prev : next));
      });
    };
    update();
    window.addEventListener("resize", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

/* ── Global keyboard CSS variables (R54) ────────────────────────────────────
   Every fixed/sticky surface that holds a text field (modal bottom sheets,
   support chat panel, exam chat composer) needs the same three numbers:
     --kb-top    top of the visible band (visualViewport.offsetTop)
     --kb-h      height of the visible band
     --kb-inset  distance from the layout bottom to the keyboard top
   and the class `kb-up` on <html> while the keyboard covers the page.
   innerHeight is intentionally NOT changed (LearnApp's kb-open depends on it). */
export function keyboardCssState(layoutHeight, vv) {
  const band = computeKeyboardInset(layoutHeight, vv);
  const inset = band.covered ? Math.max(0, Math.round(layoutHeight - band.top - band.height)) : 0;
  return { ...band, inset };
}

/** Installs the listeners once. Returns a cleanup function. */
export function installKeyboardCssVars(win = typeof window !== "undefined" ? window : null) {
  if (!win || !win.document) return () => {};
  const root = win.document.documentElement;
  let frame = 0;
  const apply = () => {
    frame = 0;
    const s = keyboardCssState(win.innerHeight, win.visualViewport);
    root.style.setProperty("--kb-top", `${s.top}px`);
    root.style.setProperty("--kb-h", `${s.covered ? s.height : win.innerHeight}px`);
    root.style.setProperty("--kb-inset", `${s.inset}px`);
    root.classList.toggle("kb-up", s.covered);
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(apply); };
  apply();
  const vv = win.visualViewport;
  win.addEventListener("resize", schedule);
  vv?.addEventListener("resize", schedule);
  vv?.addEventListener("scroll", schedule);
  return () => {
    if (frame) win.cancelAnimationFrame(frame);
    win.removeEventListener("resize", schedule);
    vv?.removeEventListener("resize", schedule);
    vv?.removeEventListener("scroll", schedule);
    root.classList.remove("kb-up");
    root.style.removeProperty("--kb-top");
    root.style.removeProperty("--kb-h");
    root.style.removeProperty("--kb-inset");
  };
}
