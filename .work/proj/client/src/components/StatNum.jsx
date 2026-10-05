import { useEffect, useRef, useState } from "react";

/* Count-up number microinteraction for stat cards & reward chips.
   - Respects prefers-reduced-motion (jumps straight to the value).
   - Optional `delay` (ms) staggers the start so several numbers can cascade.
   - Backward compatible: <StatNum value={n} /> still works exactly as before. */
export default function StatNum({ value = 0, duration = 900, delay = 0 }) {
  const target = Number(value) || 0;
  const reduce = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(reduce ? target : 0);
  const raf = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    if (reduce) { setN(target); return; }
    let startTs = 0, started = false;
    const step = (ts) => {
      if (!started) { startTs = ts; started = true; }
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
      setN(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    const begin = () => { raf.current = requestAnimationFrame(step); };
    if (delay > 0) { setN(0); timer.current = setTimeout(begin, delay); }
    else begin();
    return () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, delay]);
  return <>{n}</>;
}
