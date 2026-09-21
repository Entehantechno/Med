import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import StatNum from "../../components/StatNum.jsx";
import CalibrationReport from "../../components/CalibrationReport.jsx";

/* Performance dashboard: accuracy & activity stats, a 7-day trend, weakest
   topics to focus on, and shortcuts to the Mistakes hub and Notes. */
export default function Progress({ go, onProgramChange }) {
  const { t, lang } = useApp();
  const [d, setD] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [active, setActive] = useState(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => { api.get(`/learn/analytics?lang=${lang}`).then(setD).catch(() => setD({})); }, [lang]);
  useEffect(() => {
    api.get(`/learn/programs?lang=${lang}`).then((r) => { setPrograms(r.programs || []); setActive(r.active); }).catch(() => {});
  }, [lang]);

  const switchProgram = async (slug) => {
    if (slug === active || switching) return;
    setSwitching(true);
    try {
      await api.post("/learn/program", { program: slug });
      setActive(slug);
      onProgramChange?.(slug);
      window.dispatchEvent(new CustomEvent("medlab-toast", { detail: t("programSwitched") }));
      // refresh analytics for the new course
      api.get(`/learn/analytics?lang=${lang}`).then(setD).catch(() => {});
    } catch { /* */ } finally { setSwitching(false); }
  };

  if (!d) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;

  const maxAns = Math.max(1, ...(d.daily || []).map((x) => x.answered));
  const dayName = (iso) => new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { weekday: "short", timeZone: "Asia/Tehran" }).format(new Date(iso + "T00:00:00"));

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="chart" size={22} /> {t("myProgress")}</h2></div>

      {/* My course — change the active program (Duolingo-style) */}
      {programs.length > 0 && (
        <div className="card mb16">
          <div className="section-title"><h4><Icon name="book" size={18} /> {t("myProgram")}</h4></div>
          <div className="small muted mb8">{t("chooseProgram")}</div>
          <div className="program-choice">
            {programs.map((p) => (
              <button key={p.slug} type="button" disabled={switching}
                className={`program-choice-opt ${active === p.slug ? "active" : ""}`}
                onClick={() => switchProgram(p.slug)}>
                <span className="pc-emoji">{p.emoji}</span> {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overall-accuracy ring + KPI cards */}
      <div className="prog-overview mb16">
        <AccuracyRing pct={d.allTime?.accuracy ?? 0} label={t("accuracy")} />
        <div className="kpi-row prog-kpis">
          <Kpi icon="bolt" val={d.today?.answered ?? 0} label={t("answeredToday")} />
          <Kpi icon="check" val={d.today?.accuracy ?? 0} suffix="%" label={t("accuracyToday")} accent />
          <Kpi icon="book" val={d.allTime?.answered ?? 0} label={t("answeredTotal")} />
          <Kpi icon="clock" val={d.allTime?.avgSec ?? 0} suffix="s" label={t("avgTime")} />
        </div>
      </div>

      {/* 7-day activity trend */}
      <div className="card mb16">
        <div className="section-title"><h4><Icon name="chart" size={18} /> {t("last7days")}</h4>
          <span className="tag">{t("accuracy")}: {d.week?.accuracy ?? 0}%</span></div>
        <div className="trend trend-grid">
          {(d.daily || []).map((x, i) => {
            const cls = x.answered === 0 ? "empty" : x.accuracy >= 80 ? "good" : x.accuracy >= 50 ? "mid" : "low";
            return (
              <div className="trend-col" key={x.day}>
                <div className="trend-bar-wrap">
                  <div className={`trend-bar acc-${cls}`}
                    style={{ height: `${(x.answered / maxAns) * 100}%`, "--grow-delay": `${i * 70}ms` }}
                    title={`${x.answered} · ${x.accuracy}%`}>
                    <span className="trend-acc">{x.answered > 0 ? `${x.accuracy}%` : ""}</span>
                  </div>
                </div>
                <div className="small muted">{dayName(x.day)}</div>
              </div>
            );
          })}
          {(!d.daily || d.daily.length === 0) && <div className="small muted center" style={{ padding: 20, width: "100%" }}>{t("noData")}</div>}
        </div>
        <div className="trend-legend">
          <span className="tl-item"><i className="tl-dot acc-good" /> ≥80%</span>
          <span className="tl-item"><i className="tl-dot acc-mid" /> 50–79%</span>
          <span className="tl-item"><i className="tl-dot acc-low" /> &lt;50%</span>
        </div>
      </div>

      {/* confidence calibration (metacognition — "do you know what you know?") */}
      <CalibrationReport />

      {/* weakest topics */}
      <div className="card mb16">
        <div className="section-title"><h4><Icon name="target" size={18} /> {t("weakTopics")}</h4></div>
        <div className="small muted mb8">{t("weakTopicsHint")}</div>
        {(d.weakTopics || []).length === 0
          ? <div className="small muted center" style={{ padding: 16 }}>{t("noWeakYet")}</div>
          : d.weakTopics.map((w) => (
            <div className="weak-row" key={w.node_id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{lang === "fa" ? (w.title_fa || w.title_en) : (w.title_en || w.title_fa)}</div>
                <div className="pbar sm"><span style={{ width: `${w.accuracy}%`, background: w.accuracy < 50 ? "var(--flame)" : "var(--primary)" }} /></div>
              </div>
              <span className={`tag ${w.accuracy < 50 ? "danger" : ""}`}>{w.accuracy}%</span>
            </div>
          ))}
      </div>

      {/* shortcuts */}
      <div className="grid grid-2">
        <button className="card mod-card" onClick={() => go("mistakes")} style={{ cursor: "pointer" }}>
          <div className="mod-ico" style={{ background: "var(--grad-warm)" }}><Icon name="warn" size={26} /></div>
          <h3>{t("mistakesHub")}</h3>
          <div className="small muted">{t("mistakesHubHint")}</div>
        </button>
        <button className="card mod-card" onClick={() => go("notes")} style={{ cursor: "pointer" }}>
          <div className="mod-ico" style={{ background: "var(--grad-primary)" }}><Icon name="edit" size={26} /></div>
          <h3>{t("myNotes")}</h3>
          <div className="small muted">{t("myNotesHint")}</div>
        </button>
      </div>
    </div>
  );
}

function Kpi({ icon, val, label, accent, suffix = "" }) {
  const numeric = typeof val === "number";
  return (
    <div className={`kpi kpi-3d ${accent ? "accent" : ""}`}>
      <div className="kpi-ico"><Icon name={icon} size={18} /></div>
      <div>
        <b>{numeric ? <><StatNum value={val} duration={900} />{suffix}</> : val}</b>
        <div className="small muted">{label}</div>
      </div>
    </div>
  );
}

/* A compact conic-gradient accuracy ring with a count-up center number. */
function AccuracyRing({ pct = 0, label }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const color = p >= 80 ? "var(--green)" : p >= 50 ? "var(--warn)" : "var(--flame)";
  return (
    <div className="acc-ring" style={{ "--p": `${p}%`, "--ring": color }} role="img" aria-label={`${label}: ${p}%`}>
      <div className="acc-ring-hole">
        <div className="acc-ring-num"><StatNum value={p} duration={1100} />%</div>
        <div className="acc-ring-lbl small muted">{label}</div>
      </div>
    </div>
  );
}
