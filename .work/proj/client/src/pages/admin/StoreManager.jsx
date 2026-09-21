import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api, getToken } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, Modal, useToast } from "../../components/UI.jsx";

/* Admin store manager: create/edit/delete courses, manage their video lessons,
   choose which lessons are free previews, set price/discount, and publish. */
export default function StoreManager() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [courses, setCourses] = useState(null);
  const [edit, setEdit] = useState(null);
  const [manage, setManage] = useState(null); // course id whose lessons we manage

  const load = () => api.get("/store/admin/courses").then((d) => setCourses(d.courses)).catch(() => setCourses([]));
  useEffect(() => { load(); }, []);
  if (manage) return <LessonManager courseId={manage} onBack={() => { setManage(null); load(); }} />;
  if (!courses) return <Spinner />;

  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/store/admin/courses/${id}`); toast(t("saved")); load(); } };
  const togglePub = async (c) => { await api.put(`/store/admin/courses/${c.id}`, { published: !c.published }); load(); };
  const toman = (r) => (r / 10).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="store" size={22} /> {t("storeManager")}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}><Icon name="store" size={14} /> {t("newCourse")}</button>
      </div>
      <div className="muted small mb16">{t("storeManagerHint")}</div>
      {courses.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="store" size={40} /></div><h3>{t("noData")}</h3></div>}
      {courses.map((c) => (
        <div className="card mb8" key={c.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{lang === "fa" ? c.title_fa : c.title_en || "—"}
                {c.published ? <span className="tag" style={{ marginInlineStart: 8, background: "var(--accentGlow)", color: "var(--accent)" }}>{t("published")}</span>
                  : <span className="tag" style={{ marginInlineStart: 8 }}>{t("draft")}</span>}</div>
              <div className="small muted">{c.lessonCount} {t("videosCount")} · {c.freeCount} {t("freePreview")} · {c.enrolled} {t("enrolled")} · {c.price ? `${toman(c.price)} ${t("toman")}` : t("free")}</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setManage(c.id)}><Icon name="play" size={13} /> {t("manageLessons")}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => togglePub(c)}>{c.published ? t("unpublish") : t("publish")}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEdit(c)}><Icon name="edit" size={13} /></button>
            <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}><Icon name="trash" size={13} /></button>
          </div>
        </div>
      ))}
      {edit && <CourseModal course={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast(t("saved")); load(); }} />}
    </div>
  );
}

function CourseModal({ course, onClose, onSaved }) {
  const { t } = useApp();
  const [f, setF] = useState({
    title_fa: course.title_fa || "", title_en: course.title_en || "",
    desc_fa: course.desc_fa || "", desc_en: course.desc_en || "",
    cover: course.cover || "", instructor_fa: course.instructor_fa || "", instructor_en: course.instructor_en || "",
    price: course.price || 0, discount_price: course.discount_price ?? "", level: course.level || "all",
    published: !!course.published,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (course.id) await api.put(`/store/admin/courses/${course.id}`, f);
    else await api.post("/store/admin/courses", f);
    onSaved();
  };
  return (
    <Modal title={course.id ? t("editCourse") : t("newCourse")} onClose={onClose} onSave={save}>
      <div className="grid grid-2">
        <div className="field"><label>{t("title")} (FA)</label><input value={f.title_fa} onChange={(e) => set("title_fa", e.target.value)} /></div>
        <div className="field"><label>{t("title")} (EN)</label><input value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("courseDesc")} (FA)</label><textarea value={f.desc_fa} onChange={(e) => set("desc_fa", e.target.value)} /></div>
      <div className="field"><label>{t("courseDesc")} (EN)</label><textarea value={f.desc_en} onChange={(e) => set("desc_en", e.target.value)} /></div>
      <div className="grid grid-2">
        <div className="field"><label>{t("instructor")} (FA)</label><input value={f.instructor_fa} onChange={(e) => set("instructor_fa", e.target.value)} /></div>
        <div className="field"><label>{t("instructor")} (EN)</label><input value={f.instructor_en} onChange={(e) => set("instructor_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("coverImageUrl")}</label><input value={f.cover} onChange={(e) => set("cover", e.target.value)} placeholder="/uploads/..." style={{ direction: "ltr" }} /></div>
      <div className="grid grid-2">
        <div className="field"><label>{t("priceRial")}</label><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
        <div className="field"><label>{t("discountPriceRial")}</label><input type="number" value={f.discount_price} onChange={(e) => set("discount_price", e.target.value)} placeholder={t("optional")} /></div>
      </div>
      <div className="field"><label>{t("level")}</label>
        <select value={f.level} onChange={(e) => set("level", e.target.value)}>
          <option value="all">{t("allLevels")}</option><option value="basic">{t("basicSciences")}</option>
          <option value="pre-internship">{t("preInternship")}</option><option value="residency">{t("residency")}</option>
        </select></div>
      <label className="toggle-row"><span>{t("published")}</span><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} /></label>
      <div className="small muted mt8">{t("priceHint")}</div>
    </Modal>
  );
}

function LessonManager({ courseId, onBack }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get(`/store/admin/courses/${courseId}`).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, [courseId]);
  if (!data) return <Spinner />;

  const del = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/store/admin/lessons/${id}`); toast(t("saved")); load(); } };
  const toggleFree = async (l) => { await api.put(`/store/admin/lessons/${l.id}`, { free_preview: !l.free_preview }); load(); };

  return (
    <div className="page">
      <div className="section-title"><h2>{lang === "fa" ? data.course.title_fa : data.course.title_en}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}><Icon name="play" size={13} /> {t("newLessonVideo")}</button>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button>
        </div>
      </div>
      <div className="muted small mb16">{t("lessonManagerHint")}</div>
      {data.lessons.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="play" size={40} /></div><h3>{t("noData")}</h3></div>}
      {data.lessons.map((l, i) => (
        <div className="card mb8" key={l.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="lesson-num">{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{lang === "fa" ? l.title_fa : l.title_en || "—"}</div>
              <div className="small muted">{l.duration} · {l.video_url ? "🎬" : t("noVideo")}</div>
            </div>
            <button className={`btn btn-sm ${l.free_preview ? "btn-accent" : "btn-ghost"}`} onClick={() => toggleFree(l)} title={t("freePreview")}>
              {l.free_preview ? `✓ ${t("freePreview")}` : t("makeFree")}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEdit(l)}><Icon name="edit" size={13} /></button>
            <button className="btn btn-sm btn-danger" onClick={() => del(l.id)}><Icon name="trash" size={13} /></button>
          </div>
        </div>
      ))}
      {edit && <LessonModal courseId={courseId} lesson={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast(t("saved")); load(); }} />}
    </div>
  );
}

function LessonModal({ courseId, lesson, onClose, onSaved }) {
  const { t } = useApp();
  const toast = useToast();
  const fileRef = useRef(null);
  const [f, setF] = useState({
    title_fa: lesson.title_fa || "", title_en: lesson.title_en || "",
    video_url: lesson.video_url || "", duration: lesson.duration || "", free_preview: !!lesson.free_preview,
  });
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("video", file);
      const res = await fetch("/api/upload/video", { method: "POST", credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const j = await res.json();
      if (j.url) { set("video_url", j.url); toast(t("uploaded")); } else toast(j.error || "error");
    } catch { toast("error"); } finally { setUploading(false); }
  };
  const save = async () => {
    if (lesson.id) await api.put(`/store/admin/lessons/${lesson.id}`, f);
    else await api.post(`/store/admin/courses/${courseId}/lessons`, f);
    onSaved();
  };
  return (
    <Modal title={lesson.id ? t("editLesson") : t("newLessonVideo")} onClose={onClose} onSave={save}>
      <div className="grid grid-2">
        <div className="field"><label>{t("title")} (FA)</label><input value={f.title_fa} onChange={(e) => set("title_fa", e.target.value)} /></div>
        <div className="field"><label>{t("title")} (EN)</label><input value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("videoUrl")}</label>
        <input value={f.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="/uploads/vid_... یا لینک" style={{ direction: "ltr" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="download" size={13} /> {uploading ? t("uploading") : t("uploadVideo")}
          </button>
          <input ref={fileRef} type="file" accept="video/*" onChange={upload} style={{ display: "none" }} />
        </div>
      </div>
      <div className="field"><label>{t("duration")}</label><input value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="12:30" style={{ direction: "ltr" }} /></div>
      <label className="toggle-row"><span><Icon name="check" size={15} /> {t("freePreviewToggle")}</span>
        <input type="checkbox" checked={f.free_preview} onChange={(e) => set("free_preview", e.target.checked)} /></label>
      <div className="small muted mt8">{t("freePreviewHint")}</div>
    </Modal>
  );
}
