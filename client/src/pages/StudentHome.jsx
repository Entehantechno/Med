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
          <button type="button" className="btn btn-primary mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
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
    title: t("modExams"), desc: t("modExamsDesc"), badge: activeExams.length, action: "myExams" });
  if (hasClasses) modules.push({ key: "classes", ico: "class", bg: "var(--grad-primary)",
    title: t("modClasses"), desc: t("modClassesDesc"), action: "enterClass" });
  // Only surface standalone caseList when the student has direct-assigned cases without any classes:
  if (hasAssigned && !hasClasses) modules.push({ key: "caseList", ico: "patient", bg: "var(--grad-ocean)",
    title: t("modCases"), desc: t("modCasesDesc"), action: "startVp" });

  // One hero: the open exam if there is one, otherwise the first module. The rest are compact cards.
  const liveHero = activeExams.length > 0;
  const heroModule = liveHero ? null : modules[0];
  const restModules = liveHero ? modules : modules.slice(1);
  const chevron = lang === "fa" ? "chevronLeft" : "chevronRight";

  return (
    <div className="app">
      <TopBar onHome={() => go("home")} />
      <div className="container" role="main">
        <div className="section-title"><h2>{t("welcome")}، {lang === "fa" ? user.name_fa : user.name_en} </h2></div>

        {modules.length === 0 ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="inbox" size={30} /></div>
            <h3>{t("noExamsAssigned")}</h3>
            <div className="muted small mt8">{t("noExamsAssignedDesc")}</div>
          </div>
        ) : (
          <div className="sd-top">
            {liveHero ? (
              <section className="card sd-hero" aria-labelledby="sd-hero-title">
                <div className="sd-hero-head">
                  <span className="sd-ico sd-ico-ok"><Icon name="circleCheck" size={22} /></span>
                  <div><h3 id="sd-hero-title">{t("activeExams")}</h3><p className="muted small">{t("stateOpen")}</p></div>
                </div>
                {activeExams.map((e) => (
                  <div className="case-item" key={e.id}>
                    <div>
                      <strong>{biField(e, "title", lang)}</strong>
                      <div className="case-meta">
                        <span className="tag"><Icon name="clock" size={16} /> {e.duration_min} {t("min")}</span>
                        <span className="tag"><Icon name="clock" size={16} /> {fmtDateTime(e.ends_at, lang)}</span>
                      </div>
                    </div>
                    <button type="button" className="btn btn-accent" onClick={() => go("exams")}>{t("enterExam")}</button>
                  </div>
                ))}
              </section>
            ) : (
              <section className="card sd-hero" aria-labelledby="sd-hero-title">
                <div className="sd-hero-head">
                  <span className="sd-ico"><Icon name={heroModule.ico} size={22} /></span>
                  <div><h3 id="sd-hero-title">{heroModule.title}</h3><p className="muted">{heroModule.desc}</p></div>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => go(heroModule.key)}>
                  {t(heroModule.action)} <Icon name={chevron} size={16} />
                </button>
              </section>
            )}

            <div className="sd-stats">
              <button type="button" className="card sd-stat sd-stat-link" onClick={() => go("exams")}>
                <span className="sd-ico"><Icon name="exam" size={18} /></span>
                <span><span className="num"><StatNum value={data.exams.length} /></span><span className="lbl">{t("myExams")}</span></span>
              </button>
              <button type="button" className="card sd-stat sd-stat-link" onClick={() => go("classes")}>
                <span className="sd-ico"><Icon name="class" size={18} /></span>
                <span><span className="num"><StatNum value={data.classes.length} /></span><span className="lbl">{t("myClasses")}</span></span>
              </button>
              <div className="card sd-stat" title={t("myProgress")}>
                <span className="sd-ico"><Icon name="chart" size={18} /></span>
                <span><span className="num"><StatNum value={data.mine.length} /></span><span className="lbl">{t("myProgress")}</span></span>
              </div>
            </div>

            {restModules.length > 0 && (
              <div className="sd-mods">
                {restModules.map((m) => (
                  <button type="button" className="card sd-mod" key={m.key} onClick={() => go(m.key)}>
                    <span className="sd-ico" style={{ background: m.bg, color: "#fff", position: "relative" }}>
                      <Icon name={m.ico} size={20} />
                      {m.badge > 0 && <span className="sd-badge">{m.badge}</span>}
                    </span>
                    <span className="sd-mod-text"><strong>{m.title}</strong><span className="muted small">{m.desc}</span></span>
                    <Icon name={chevron} size={18} className="sd-mod-go" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
