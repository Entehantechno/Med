import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Emphasis from "../../components/Emphasis.jsx";

export default function Summaries() {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");

  useEffect(() => {
    setErr(null);
    api.get(`/learn/summaries?lang=${lang}`)
      .then(setData)
      .catch((e) => setErr(e.message === "premium only" || e.message === "HTTP 402" ? "premium" : e.message));
  }, [lang]);

  if (err === "premium") {
    return (
      <div className="card empty-state">
        <div className="ico"><Icon name="crown" size={40} /></div>
        <h3>{t("summariesPremiumTitle")}</h3>
        <p className="muted">{t("summariesPremiumBody")}</p>
        <button className="btn btn-accent" type="button" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))}>
          <Icon name="crown" size={15} /> {t("browseGoPremium")}
        </button>
      </div>
    );
  }
  if (!data) return <div className="card"><div className="skeleton" style={{ height: 180 }} /></div>;

  const needle = q.trim().toLowerCase();
  const topics = (data.topics || []).map((tp) => {
    if (!needle) return tp;
    const nameHit = String(tp.name || "").toLowerCase().includes(needle);
    const chapters = (tp.chapters || []).filter((ch) => {
      const hay = `${ch.title || ""} ${(ch.bullets || []).join(" ")}`.toLowerCase();
      return nameHit || hay.includes(needle);
    });
    if (!nameHit && !chapters.length) return null;
    return { ...tp, chapters: nameHit ? (tp.chapters || []) : chapters };
  }).filter(Boolean);

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="book" size={22} /> {t("summariesTitle")}</h2></div>
      <p className="muted small">{t("summariesHint")}</p>
      <div className="browse-search" style={{ margin: "10px 0 16px" }}>
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("summariesSearch")} aria-label={t("summariesSearch")} />
      </div>
      {topics.map((tp) => (
        <div key={tp.topicId} className="card mt16">
          <button className="sum-topic" onClick={() => setOpen((o) => ({ ...o, [tp.topicId]: !o[tp.topicId] }))}>
            <b>{tp.name}</b>
            <span className="muted small">{(tp.chapters || []).length} {fa ? "فصل" : "chapters"}</span>
          </button>
          {open[tp.topicId] && (tp.chapters || []).map((ch) => (
            <div key={ch.nodeId} className="chapter-summary" style={{ marginTop: 10 }}>
              <div className="cs-title">{ch.title}</div>
              <ul className="cs-list">
                {(ch.bullets || []).map((b, i) => <li key={i}><Emphasis text={b} /></li>)}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
