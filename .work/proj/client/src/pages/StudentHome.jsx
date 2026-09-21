import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText } from "../api.js";
import { TopBar, Pill } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import { fmtDateTime } from "../utils/date.js";
import StatNum from "../components/StatNum.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonCards } from "../components/Skeleton.jsx";

export default function StudentHome({ go }) {
  const { t, user, lang } = useApp();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const load = () => {
    setLoadErr("");
    setData(null);
    (async () => {
      try {
        const [exams, classes, mine, assigned] = await Promise.all([
          api.get("/exams", { timeoutMs: 20_000, stage: "boot" }),
          api.get("/classes", { timeoutMs: 20_000, stage: "boot" }),
          api.get("/reports/my", { timeoutMs: 20_000, stage: "boot" }),
          api.get("/cases", { timeoutMs: 20_000, stage: "boot" }),
        ]);
        setData({
          exams: Array.isArray(exams) ? exams : [],
          classes: Array.isArray(classes) ? classes : [],
          mine: Array.isArray(mine) ? mine : [],
          assigned: Array.isArray(assigned) ? assigned : [],
        });
      } catch (e) {
        setLoadErr(loadFailKind(e));
      }
    })();
  };
  useEffect(() => { load(); }, []);

  if (!data && !loadErr) return (
    <div className="app"><TopBar onHome={() => go("home")} />
      <div className="container"><div className="section-title"><h2>{t("welcome")} </h2></div><SkeletonCards /></div>
    </div>
  );

  if (loadErr) return (
    <div className="app"><TopBar onHome={() => go("home")} />
      <div className="container">
        <div className="section-title"><h2>{t("welcome")}</h2></div>
        <div className="card empty-state">
          <div className="ico"><Icon name="warn" size={30} /></div>
          <h3>{lang === "fa" ? "«بارگذاری خانه» قطع شد" : "[Loading home] failed"}</h3>
          <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
          <button className="btn btn-primary mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
        </div>
      </div>
    </div>
  );

  const activeExams = data.exams.filter((e) => e.state === "open");
  const hasExams = data.exams.length > 0;
  const hasClasses = data.classes.length > 0;
  const hasAssigned = (data.assigned || []).length > 0;

   // Classes remain the main classroom entry. Students access virtual patient
   // cases directly through their classes or scheduled exams.
   const modules = [];
   if (hasExams) modules.push({ key: "exams", ico: "exam", bg: "var(--grad-purple)",
     title: t("modExams"), desc: t("modExamsDesc"), badge: activeExams.length });
   if (hasClasses) modules.push({ key: "classes", ico: "class", bg: "var(--grad-primary)",
     title: t("modClasses"), desc: t("modClassesDesc") });
   // Only surface standalone caseList when the student has direct-assigned cases without any classes:
   if (hasAssigned && !hasClasses) modules.push({ key: "caseList", ico: "patient", bg: "var(--grad-ocean)",
     title: t("modCases"), desc: t("modCasesDesc") });

  return (
    <div className="app">
      <TopBar onHome={() => go("home")} />
      <div className="container">
        <div className="section-title"><h2>{t("welcome")}، {lang === "fa" ? user.name_fa : user.name_en} </h2></div>

        {/* Active exams banner — the most important thing for a student */}
        {activeExams.length > 0 && (
          <div className="card mb16" style={{ borderInlineStart: "4px solid var(--ok)" }}>
            <div className="section-title" style={{ marginBottom: 12 }}>
              <h4 style={{ color: "var(--ok)", borderBottom: "none", padding: 0 }}><Icon name="circleCheck" size={16} /> {t("activeExams")}</h4>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {activeExams.map((e) => (
                <div className="case-item" key={e.id}>
                  <div>
                    <strong>{biField(e, "title", lang)}</strong>
                    <div className="case-meta">
                      <Pill kind="active">{t("stateOpen")}</Pill>
                      <span className="tag"><Icon name="clock" size={16} /> {e.duration_min} {t("min")}</span>
                      <span className="tag"><Icon name="clock" size={16} /> {fmtDateTime(e.ends_at, lang)}</span>
                    </div>
                  </div>
                  <button className="btn btn-accent" onClick={() => go("exams")}>{t("enterExam")}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="inbox" size={30} /></div>
            <h3>{t("noExamsAssigned")}</h3>
            <div className="muted small mt8">{t("noExamsAssignedDesc")}</div>
          </div>
        ) : (
          <div className={`grid grid-${Math.min(modules.length, 3)} mb16`}>
            {modules.map((m) => (
              <button className="card mod-card mod-card-row" key={m.key} onClick={() => go(m.key)}>
                <div className="mod-ico" style={{ background: m.bg, position: "relative" }}><Icon name={m.ico} size={26} />
                  {m.badge > 0 && <span style={{ position: "absolute", top: -6, insetInlineEnd: -6,
                    background: "var(--ok)", color: "#fff", borderRadius: 999, fontSize: ".62rem",
                    fontWeight: 800, padding: "1px 7px" }}>{m.badge}</span>}
                </div>
                <div className="mod-card-body">
                  <h3>{m.title}</h3><p>{m.desc}</p>
                </div>
                <Icon name={lang === "fa" ? "chevronLeft" : "chevronRight"} size={18} className="mod-card-go" />
              </button>
            ))}
          </div>
        )}

        {/* At-a-glance counters that ALSO navigate — a student can always reach
            their exams / classes / progress straight from the home. */}
        <div className="grid grid-3">
          <button className="card stat-card stat-card-link" onClick={() => go("exams")}>
            <div className="num"><StatNum value={data.exams.length} /></div><div className="lbl">{t("myExams")}</div></button>
          <button className="card stat-card stat-card-link" onClick={() => go("classes")}>
            <div className="num"><StatNum value={data.classes.length} /></div><div className="lbl">{t("myClasses")}</div></button>
          <button className="card stat-card stat-card-link" onClick={() => go("classes")}>
            <div className="num"><StatNum value={data.mine.length} /></div><div className="lbl">{t("myProgress")}</div></button>
        </div>
      </div>
    </div>
  );
}
