import Icon, { hasIcon } from "./Icon.jsx";

/* Emoji → icon map for DATA-driven emoji (topic/program/level badges sent by the
   server). Keys are emoji without variation selectors. Unmapped emoji fall back to
   a generic "book" icon, and plain words are rendered as text. */
const EMOJI_ICON = {
  "🩺": "stethoscope", "🔬": "flask", "🧪": "flask", "🧫": "flask", "🧬": "flask", "🦠": "flask", "⚛": "flask", "🧴": "flask",
  "📚": "book", "📖": "book", "🥚": "book", "🦋": "book", "💊": "ampoule", "🧠": "brain",
  "🫀": "heart", "🩸": "heart", "❤": "heart", "🫁": "stethoscope", "🦴": "xray", "🩻": "xray", "🫘": "xray",
  "👁": "eye", "👂": "ai", "💪": "strength", "📊": "chart", "🛡": "shield", "⚖": "bulb",
  "🚑": "patient", "🤰": "patient", "🧸": "patient", "🦿": "patient", "🏥": "patient", "🛋": "patient",
  "🔪": "wrench", "🥗": "stomach", "🧲": "bolt", "🎓": "cap", "🏅": "medal", "🥇": "medal", "🔥": "flame",
  "⭐": "star", "🌟": "star", "💎": "star", "🏆": "trophy", "🎯": "target", "👑": "crown", "🤖": "ai",
  "⚠": "warn", "✅": "check", "❌": "close", "✕": "close", "🔒": "lock", "🔔": "bell", "🔕": "bell", "📣": "bell",
  "🧩": "puzzle", "🎲": "dice", "💡": "bulb", "❓": "bulb", "🔗": "link", "🎁": "gift", "🚩": "flag",
  "🔊": "volume", "🔇": "volume", "🔎": "search", "🔍": "search", "♾": "heart", "🚫": "shield", "📘": "book", "🧭": "compass", "📍": "pin", "👥": "users", "👤": "user", "🧑": "user",
  "🛒": "store", "🔍": "search", "⚙": "settings", "🌐": "globe", "🖼": "image", "💬": "chat", "📝": "edit",
  "✏": "edit", "▶": "play", "🚀": "bolt", "🗂": "list", "🕒": "clock", "⏰": "clock", "📅": "clock", "🎉": "party",
};
const norm = (v) => String(v).replace(/[\uFE0E\uFE0F\u200D]/g, "").trim();

export function Glyph({ value, size = "1em", style, className = "" }) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const key = hasIcon(raw) ? raw : (EMOJI_ICON[norm(raw)] || EMOJI_ICON[raw]);
  if (key) {
    return <Icon name={key} size={size} className={className} style={{ verticalAlign: "-0.125em", ...style }} />;
  }
  if (/[\p{L}\p{N}]/u.test(raw)) return <span className={className}>{raw}</span>;
  return <Icon name="book" size={size} className={className} style={{ verticalAlign: "-0.125em", ...style }} />;
}
