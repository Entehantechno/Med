/* StatIcons — the ONE canonical set of crisp, colorful inline-SVG icons for the
   core learner stats (hearts, gems, XP, streak). Using SVGs (not emoji) means
   every icon renders IDENTICALLY at any size and on any background (white HUD
   chips, the purple welcome hero, dark mode) — fixing the mismatch where the
   HUD used a clock/medal while the hero used 🔥/⭐ and emoji rendered
   differently per platform. Self-contained, offline-safe, AI-free.

   Note: 💎 (diamond) is the DIAMOND TIER — a rank. So the gems CURRENCY must
   NOT look like a diamond (that caused real confusion when a diamond-shaped
   gem sat next to the "الماس / Diamond" tier badge). Gems use a crisp SVG
   SYRINGE (vaccine) — thematic to a medical app and clearly distinct. */

const base = (size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  "aria-hidden": "true", focusable: "false",
  style: { display: "inline-block", verticalAlign: "-0.18em", flex: "none" },
});

/* Gems currency — a clean diagonal SYRINGE (vaccine). Unmistakably medical and
   NOT a diamond, so it never reads as the "Diamond tier". */
export function GemIcon({ size = 18, className = "" }) {
  return (
    <svg className={`stat-icon gem-icon ${className}`} {...base(size)}>
      <g transform="rotate(45 12 12)">
        {/* barrel */}
        <rect x="8.4" y="6.2" width="7.2" height="11.6" rx="1.4" fill="#43c9dd" />
        <rect x="8.4" y="6.2" width="3.4" height="11.6" rx="1.4" fill="#7fe3f0" />
        {/* fluid level */}
        <rect x="9.2" y="11.2" width="5.6" height="6" rx="0.8" fill="#1699ad" />
        {/* plunger top + flange */}
        <rect x="9.6" y="2.4" width="4.8" height="1.5" rx="0.7" fill="#2c3e73" />
        <rect x="11.1" y="3.6" width="1.8" height="3.2" fill="#2c3e73" />
        <rect x="7.4" y="6" width="9.2" height="1.4" rx="0.7" fill="#2c3e73" />
        {/* needle */}
        <rect x="11.4" y="17.8" width="1.2" height="2.4" fill="#93a4c9" />
        <rect x="11.7" y="20" width="0.6" height="2" fill="#93a4c9" />
        {/* gloss */}
        <rect x="9" y="7.2" width="1.1" height="9.4" rx="0.55" fill="#ffffff" opacity="0.5" />
      </g>
    </svg>
  );
}

/* Hearts — a FULL, symmetric glossy red heart (emoji-style ❤️). A soft radial
   sheen on the upper-left lobe gives it depth without a hard seam. */
export function HeartIcon({ size = 18, className = "" }) {
  const gid = `heartG${size}`;
  return (
    <svg className={`stat-icon heart-icon ${className}`} {...base(size)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6a85" />
          <stop offset="1" stopColor="#e8324f" />
        </linearGradient>
      </defs>
      <path d="M12 20.7c-.35 0-.69-.12-.95-.36C6.1 15.9 3 13 3 9.4 3 6.9 4.9 5 7.4 5c1.6 0 3.05.83 3.9 2.12l.7 1.06.7-1.06A4.66 4.66 0 0 1 16.6 5C19.1 5 21 6.9 21 9.4c0 3.6-3.1 6.5-8.05 10.94-.26.24-.6.36-.95.36Z"
        fill={`url(#${gid})`} />
      <ellipse cx="8.3" cy="9" rx="2" ry="1.5" fill="#ffffff" opacity="0.45" transform="rotate(-35 8.3 9)" />
    </svg>
  );
}

/* XP — bright gold five-point star with a highlight. Pass `muted` for the
   "unearned" outline state used in rating rows. */
export function XpIcon({ size = 18, className = "", muted = false }) {
  if (muted) {
    return (
      <svg className={`stat-icon xp-icon xp-muted ${className}`} {...base(size)}>
        <path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5Z"
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg className={`stat-icon xp-icon ${className}`} {...base(size)}>
      <path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5Z" fill="#f6c343" />
      <path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9V2.5Z" fill="#e0a91c" />
      <path d="M9.3 5.9 10.4 8l-2 .3.4-2.1 .5-.3Z" fill="#fff3cf" opacity="0.9" />
    </svg>
  );
}

/* Streak — a FULL, plump flame (emoji-style 🔥): a rounded orange body with a
   warm gradient and a bright yellow inner core. Symmetric and complete. */
export function StreakIcon({ size = 18, className = "" }) {
  const gid = `flameG${size}`;
  return (
    <svg className={`stat-icon streak-icon ${className}`} {...base(size)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb038" />
          <stop offset="0.55" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#f24d13" />
        </linearGradient>
      </defs>
      {/* outer flame body — rounded, plump, symmetric */}
      <path d="M12 2.2c-.5 1.9-1.6 3.2-2.9 4.5C7.4 8.5 6 10.4 6 13.2 6 16.9 8.7 20 12 20s6-3.1 6-6.8c0-2-.8-3.7-1.9-5.2-.5 1-1.2 1.7-2 2.2.6-2.6-.2-5.3-2.1-8Z"
        fill={`url(#${gid})`} />
      {/* inner core — bright yellow teardrop */}
      <path d="M12 11c-1.2 1-2 2.2-2 3.6C10 16.5 10.9 18 12 18s2-1.5 2-3.4c0-1.4-.8-2.6-2-3.6Z"
        fill="#ffe14d" />
    </svg>
  );
}
