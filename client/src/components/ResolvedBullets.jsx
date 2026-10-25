/* ResolvedBullets — a summary list whose missing-language bullets are
   translated in place (see lib/lesson-translate.js). Nothing is requested
   while `enabled` is false (for example a collapsed chapter). */
import { useMemo } from "react";
import Emphasis from "./Emphasis.jsx";
import { useLessonTranslations, resolveSummaryBullets, summaryLoading } from "../lib/lesson-translate.js";

export function useSummaryBullets(summary, enabled = true) {
  const items = useMemo(() => {
    if (Array.isArray(summary?.items)) return summary.items;
    return (summary?.bullets || []).map((text, i) => ({ cardId: `b${i}`, field: "lead", text, pending: null }));
  }, [summary]);
  const reqs = useMemo(() => {
    const seen = new Map();
    for (const it of items) if (it.pending && !seen.has(it.cardId)) seen.set(it.cardId, it.pending);
    return [...seen.values()];
  }, [items]);
  const byCard = useLessonTranslations(reqs, enabled && reqs.length > 0);
  return {
    bullets: resolveSummaryBullets(items, byCard),
    loading: enabled && summaryLoading(items, byCard),
  };
}

export default function ResolvedBullets({ summary, enabled = true, fa = true }) {
  const { bullets, loading } = useSummaryBullets(summary, enabled);
  return (
    <>
      <ul className="cs-list">
        {bullets.map((b, i) => <li key={i}><Emphasis text={b} /></li>)}
      </ul>
      {loading && <div className="small muted">{fa ? "⏳ ترجمهٔ بخشی از خلاصه در حال انجام است…" : "⏳ Translating part of the summary…"}</div>}
    </>
  );
}
