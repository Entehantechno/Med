import { useState } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";
import { normFa } from "./SearchBox.jsx";

/* HighlightableStem — renders a clinical-vignette question stem and, when the
   admin has provided `highlights` (key clue phrases), offers a toggle that
   marks those phrases inside the text (AMBOSS-style). This trains the learner
   to notice "what matters in the vignette" — a core clinical-reasoning skill.
   AI-free: the phrases are authored by the admin. Safe: it only wraps literal
   substring matches, escaping any HTML. */
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export default function HighlightableStem({ text, highlights = [], className = "lesson-q", style = {} }) {
  const { t } = useApp();
  const [on, setOn] = useState(false);
  const has = Array.isArray(highlights) && highlights.filter(Boolean).length > 0;

  if (!has || !on) {
    return (
      <div className={className} style={style}>
        {text}
        {has && (
          <button type="button" className="hl-toggle" onClick={() => setOn(true)} title={t("highlightHint")}>
            <Icon name="bulb" size={13} /> {t("highlightClues")}
          </button>
        )}
      </div>
    );
  }

  // build a single regex of all phrases (longest first so nested matches win)
  const phrases = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  const lower = new Set(phrases.map((p) => normFa(p)));
  const re = new RegExp(`(${phrases.map(escapeRe).join("|")})`, "gi");
  // split() with a capturing group keeps the delimiters; a captured part that
  // matches one of our phrases (case-insensitive) becomes a highlight.
  const parts = String(text).split(re);
  return (
    <div className={className} style={style}>
      {parts.map((p, i) =>
        p && lower.has(normFa(p))
          ? <mark key={i} className="stem-hl">{p}</mark>
          : <span key={i}>{p}</span>
      )}
      <button type="button" className="hl-toggle on" onClick={() => setOn(false)} title={t("highlightHide")}>
        <Icon name="bulb" size={13} /> {t("highlightHideShort")}
      </button>
    </div>
  );
}
