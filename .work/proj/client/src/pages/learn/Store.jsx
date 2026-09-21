import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Course store for learners: browse published courses, watch free-preview
   lessons, buy a course, then watch all its lessons. */
export default function Store({ onRequireAuth }) {
  const { t, lang } = useApp();
  const [courses, setCourses] = useState(null);
  const [open, setOpen] = useState(null);   // course id being viewed

  const load = () => api.get(`/store/courses?lang=${lang}`).then((d) => setCourses(d.courses)).catch(() => setCourses([]));
  useEffect(() => { load(); }, [lang]);

  if (open) return <CourseDetail id={open} onBack={() => { setOpen(null); load(); }} onRequireAuth={onRequireAuth} />;
  if (!courses) return <div className="card"><div className="skeleton" style={{ height: 180 }} /></div>;

  const toman = (rial) => (rial / 10).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="store" size={22} /> {t("store")}</h2></div>
      <div className="muted small mb16">{t("storeHint")}</div>
      {courses.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="store" size={40} /></div><h3>{t("noCourses")}</h3></div>}
      <div className="store-grid">
        {courses.map((c) => (
          <div className="course-card" key={c.id} onClick={() => setOpen(c.id)}>
            <div className="course-cover" style={c.cover ? { backgroundImage: `url(${c.cover})` } : {}}>
              {!c.cover && <Icon name="play" size={40} />}
              {c.owned && <span className="course-owned">✓ {t("owned")}</span>}
            </div>
            <div className="course-body">
              <div className="course-title">{c.title}</div>
              <div className="small muted">{c.instructor} · {c.lessonCount} {t("videosCount")}</div>
              <div className="course-foot">
                {c.freeCount > 0 && <span className="tag">{c.freeCount} {t("freePreview")}</span>}
                {c.owned
                  ? <span className="course-price owned">{t("owned")}</span>
                  : c.effectivePrice === 0
                    ? <span className="course-price free">{t("free")}</span>
                    : <span className="course-price">
                        {Number(c.discount_price) > 0 && Number(c.discount_price) < c.price && <s className="muted">{toman(c.price)}</s>} {toman(c.effectivePrice)} {t("toman")}
                      </span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseDetail({ id, onBack, onRequireAuth }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/store/courses/${id}?lang=${lang}`).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, [id, lang]);
  if (!data) return <div className="card"><div className="skeleton" style={{ height: 220 }} /></div>;

  const c = data.course;
  const toman = (rial) => (rial / 10).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
  const buy = async () => {
    // logged-out visitor browsing the public store → send them to sign up first
    if (onRequireAuth) { onRequireAuth(); return; }
    setBusy(true);
    try {
      const r = await api.post(`/store/courses/${id}/buy`, {});
      if (r.owned) { load(); }        // free course enrolled instantly
      else if (r.url) window.location.href = r.url;  // go to gateway
    } catch { alert(t("payFailed")); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="section-title"><h2>{c.title}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button></div>

      {playing && (
        <div className="card mb16">
          <video src={playing} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000" }} />
        </div>
      )}

      <div className="card mb16">
        <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{c.desc}</p>
        <div className="case-meta mt8"><span className="tag"><Icon name="user" size={13} /> {c.instructor}</span>
          <span className="tag">{t(c.level === "all" ? "allLevels" : c.level)}</span></div>
        {!c.owned && c.effectivePrice > 0 && (
          <button className="btn btn-accent btn-block mt16" disabled={busy} onClick={buy}>
            <Icon name="crown" size={16} /> {t("buyCourse")} — {toman(c.effectivePrice)} {t("toman")}
          </button>
        )}
        {!c.owned && c.effectivePrice === 0 && (
          <button className="btn btn-primary btn-block mt16" disabled={busy} onClick={buy}>{t("enrollFree")}</button>
        )}
        {c.owned && <div className="micro-box small mt16" style={{ padding: "10px 14px" }}>✓ {t("youOwnCourse")}</div>}
      </div>

      <h4 className="mb8"><Icon name="book" size={16} /> {t("lessons")}</h4>
      {data.lessons.map((l, i) => (
        <div className={`lesson-item ${l.unlocked ? "" : "locked"}`} key={l.id}>
          <span className="lesson-num">{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{l.title}</div>
            <div className="small muted">{l.duration} {l.free_preview && <span className="tag" style={{ marginInlineStart: 6 }}>{t("freePreview")}</span>}</div>
          </div>
          {l.unlocked
            ? <button className="btn btn-primary btn-sm" onClick={() => setPlaying(l.video_url)}><Icon name="play" size={13} /> {t("watch")}</button>
            : <span className="lesson-lock"><Icon name="lock" size={16} /></span>}
        </div>
      ))}
    </div>
  );
}
