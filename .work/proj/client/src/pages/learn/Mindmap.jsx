import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Mind-maps: a visual tree of each subject built entirely from the
   hand-written درسنامه (golden notes + key points). No AI — just a clean
   view of the material teachers already wrote. Great for last-minute review. */
export default function Mindmap({ onBack }) {
  const { t, lang } = useApp();
  const [topics, setTopics] = useState(null);
  const [active, setActive] = useState(null);   // slug
  const [map, setMap] = useState(null);

  useEffect(() => {
    api.get(`/learn/mindmap/topics?lang=${lang}`).then((d) => setTopics(d.topics || [])).catch(() => setTopics([]));
  }, [lang]);

  const open = (slug) => {
    setActive(slug); setMap(null);
    api.get(`/learn/mindmap/${slug}?lang=${lang}`).then(setMap).catch(() => setMap({ empty: true, branches: [] }));
  };

  if (!topics) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  /* ---------- DETAIL (a topic's mind-map) ---------- */
  if (active && map) {
    return (
      <div className="page">
        <div className="section-title">
          <h2><span style={{ fontSize: "1.4rem" }}>{map.topic?.emoji}</span> {map.topic?.title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { setActive(null); setMap(null); }}>
            <Icon name={lang === "fa" ? "chevronRight" : "chevronLeft"} size={15} /> {t("mindmapAll")}
          </button>
        </div>
        {map.empty ? (
          <div className="card empty-state"><div className="ico">🗺️</div><h3>{t("mindmapEmpty")}</h3><div className="small muted">{t("mindmapEmptyHint")}</div></div>
        ) : (
          <div className="mindmap">
            <div className="mm-root" style={{ background: map.topic?.color || "#2f7fd1" }}>
              <span style={{ fontSize: "1.5rem" }}>{map.topic?.emoji}</span> {map.topic?.title}
            </div>
            <div className="mm-branches">
              {map.branches.map((br, i) => (
                <div className="mm-branch" key={i}>
                  <div className="mm-lesson">{br.emoji ? <span>{br.emoji} </span> : null}{br.lesson}</div>
                  <ul className="mm-leaves">
                    {br.children.map((c, j) => (
                      <li key={j} className={`mm-leaf ${c.kind}`}>
                        <span className="mm-dot">{c.kind === "golden" ? "⭐" : "•"}</span>
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
      </div>
    );
  }

  /* ---------- LIST (choose a topic) ---------- */
  const withContent = topics.filter((tp) => tp.hasContent);
  return (
    <div className="page">
      <div className="section-title"><h2>🗺️ {t("mindmaps")}</h2></div>
      <div className="muted small mb16">{t("mindmapsHint")}</div>
      {withContent.length === 0 ? (
        <div className="card empty-state"><div className="ico">🗺️</div><h3>{t("mindmapEmpty")}</h3></div>
      ) : (
        <div className="grid grid-2">
          {withContent.map((tp) => (
            <button key={tp.slug} className="card mm-card" onClick={() => open(tp.slug)} style={{ textAlign: "start", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mm-emoji" style={{ background: tp.color || "#2f7fd1" }}>{tp.emoji}</span>
                <div>
                  <div style={{ fontWeight: 800 }}>{tp.title}</div>
                  <div className="small muted">{tp.branches} {t("mindmapLessons")}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}
