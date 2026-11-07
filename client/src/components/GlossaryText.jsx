import { useMemo, useState } from "react";
import Emphasis from "./Emphasis.jsx";

/* Split text on glossary keys (longest first) and wrap matches in a
   clickable chip that opens a small definition popover. */

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMPTY = [];

export default function GlossaryText({ text, glossary, as: Tag = "span", className }) {
  const [open, setOpen] = useState(null);
  // Stable fallback: a fresh `[]` per render would defeat the useMemo below and
  // rebuild the (large) glossary RegExp on every keystroke of the parent.
  const entries = Array.isArray(glossary) ? glossary : EMPTY;

  const parts = useMemo(() => {
    const s = String(text || "");
    if (!s || !entries.length) return null;
    const keys = [];
    for (const g of entries) for (const k of g.keys || []) if (k && k.length > 2) keys.push({ k, def: g.def });
    keys.sort((a, b) => b.k.length - a.k.length);
    if (!keys.length) return null;
    const re = new RegExp(`(${keys.map((x) => escapeRe(x.k)).join("|")})`, "gi");
    const chunks = s.split(re);
    if (chunks.length < 2) return null;
    const defOf = (word) => {
      const low = word.toLowerCase();
      const hit = keys.find((x) => x.k.toLowerCase() === low);
      return hit?.def || "";
    };
    return chunks.map((chunk, i) => {
      if (i % 2 === 0) return { t: chunk, def: null };
      return { t: chunk, def: defOf(chunk) };
    });
  }, [text, entries]);

  if (!parts) return <Emphasis as={Tag} className={className} text={text} />;

  return (
    <Tag className={className}>
      {parts.map((p, i) => {
        if (!p.def) return <Emphasis key={i} text={p.t} />;
        const isOpen = open === i;
        return (
          <span key={i} className={`gloss-wrap ${isOpen ? "on" : ""}`}>
            <button type="button" className="gloss-word" onClick={() => setOpen(isOpen ? null : i)}>
              <Emphasis text={p.t} />
            </button>
            {isOpen && (
              <span className="gloss-pop" role="dialog">
                <span className="gloss-pop-text">{p.def}</span>
                <button type="button" className="gloss-close" onClick={() => setOpen(null)} aria-label="close">×</button>
              </span>
            )}
          </span>
        );
      })}
    </Tag>
  );
}
