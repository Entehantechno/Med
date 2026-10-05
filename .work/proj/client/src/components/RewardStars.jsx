import { useEffect, useState } from "react";
import { XpIcon } from "./StatIcons.jsx";

/* RewardStars — lights up earned stars one-by-one with a satisfying pop.
   Used on the lesson/checkpoint celebration screens. Respects
   prefers-reduced-motion (shows the final state immediately, no staggering).
   Purely presentational; AI-free. */
export default function RewardStars({ earned = 0, total = 5, size = 30, stepMs = 260 }) {
  const reduce = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // how many stars are currently "revealed" (lit + popped)
  const [shown, setShown] = useState(reduce ? earned : 0);

  useEffect(() => {
    if (reduce) { setShown(earned); return; }
    setShown(0);
    const timers = [];
    for (let i = 1; i <= earned; i++) {
      timers.push(setTimeout(() => setShown(i), i * stepMs));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, total, stepMs]);

  return (
    <div className="reward-stars" aria-label={`${earned} از ${total} ستاره`}>
      {Array.from({ length: total }, (_, idx) => {
        const i = idx + 1;
        const lit = i <= shown;
        return (
          <span key={i} className={`reward-star ${lit ? "lit" : ""}`} aria-hidden="true">
            <XpIcon size={size} muted={!lit} />
          </span>
        );
      })}
    </div>
  );
}
