import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

export default function Achievements() {
  const { t, lang } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api.get(`/learn/achievements?lang=${lang}`).then((d) => setList(d.achievements)).catch(() => setList([])); }, [lang]);
  if (!list) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="medal" size={22} /> {t("achievements")}</h2></div>
      <div className="grid grid-2">
        {list.map((a) => {
          const pct = Math.min(100, Math.round((a.progress / a.threshold) * 100));
          return (
            <div key={a.slug} className={`card achv-card ${a.unlocked ? "unlocked" : "locked"}`} style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="achv-ico" style={{
                width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", flexShrink: 0, position: "relative", overflow: "hidden",
                background: a.unlocked ? "linear-gradient(135deg,#f0c454,#d0982a)" : "var(--panel3)",
                color: a.unlocked ? "#fff" : "var(--muted)",
              }}>
                <Icon name={a.icon} size={26} />
                {a.unlocked && <span className="achv-shine" aria-hidden="true" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{a.name} {a.unlocked && <span style={{ color: "var(--green)" }}>✓</span>}</div>
                <div className="small muted">{a.desc}</div>
                {!a.unlocked && (
                  <div style={{ marginTop: 6 }}>
                    <div className="pbar" style={{ height: 6 }}><span style={{ width: `${pct}%` }} /></div>
                    <div className="small muted mt8">{a.progress} / {a.threshold}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
