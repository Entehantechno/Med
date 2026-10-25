/* Avatar — a deterministic, colorful initial-avatar so each person is visually
   distinct. The hue is derived from the name (stable per person), rendered as a
   soft two-tone gradient. Purely presentational, AI-free. */

function hueFromName(name = "?") {
  let h = 0;
  const s = String(name);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export default function Avatar({ name = "?", size = 38, streak = 0, tier }) {
  const hue = hueFromName(name);
  const letter = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div
      className={`avatar ${tier ? `av-tier-${tier}` : ""}`}
      style={{
        width: size, height: size, flex: `0 0 ${size}px`,
        "--h": hue, fontSize: Math.round(size * 0.42),
      }}
      aria-hidden="true"
    >
      <span className="avatar-letter">{letter}</span>
      {streak > 0 && <span className="avatar-streak" title={`${streak}`}>🔥</span>}
    </div>
  );
}
