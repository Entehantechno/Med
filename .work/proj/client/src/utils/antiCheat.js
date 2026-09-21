import { useEffect, useState } from "react";

/* Lightweight anti-cheat helper for exams.
   When `enabled`:
   - counts how many times the student leaves the exam tab/window
   - blocks copy / cut / context-menu (right-click) to discourage answer sharing
   Returns { leaves } so the UI can show a warning and store it. */
export function useAntiCheat(enabled) {
  const [leaves, setLeaves] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => { if (document.hidden) setLeaves((n) => n + 1); };
    const onBlur = () => setLeaves((n) => n + 1);
    const block = (e) => { e.preventDefault(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [enabled]);

  return { leaves };
}
