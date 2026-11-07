import { useEffect } from "react";

/* Nested overlays (login modal, admin modal, more-sheet) share one lock
   so closing the top one does not unlock the page while another is open. */
let lockCount = 0;

export function useScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    lockCount += 1;
    document.documentElement.classList.add("overlay-open");
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.documentElement.classList.remove("overlay-open");
    };
  }, [active]);
}
