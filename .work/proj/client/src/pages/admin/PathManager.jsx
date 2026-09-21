import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, Modal, useToast } from "../../components/UI.jsx";
import { optionLetter } from "../../lib/optionLetter.js";

/* Full admin control of the pre-internship learning path:
   add/edit/delete subjects (topics) and their lessons (nodes), choose which
   questions each lesson contains, and design new questions per lesson. */
export default function PathManager() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});           // expanded topic ids
  const [topicEdit, setTopicEdit] = useState(null);
  const [nodeEdit, setNodeEdit] = useState(null); // { topic_id, ...node }
  const [cardsFor, setCardsFor] = useState(null); // node whose cards we're picking
  const [designFor, setDesignFor] = useState(null); // node to design a question for
  const [officialImport, setOfficialImport] = useState(false); // official/past-exam import pipeline
  const [dragTopic, setDragTopic] = useState(null);       // topic id being dragged
  const [dragNode, setDragNode] = useState(null);         // { topicId, nodeId }
  const [program, setProgram] = useState("preint");       // active course being managed

  const load = () => api.get(`/admin/path?program=${program}`).then(setData).catch(() => setData({ topics: [] }));
  useEffect(() => { load(); }, [program]);
  if (!data) return <Spinner />;
  const programs = data.programs || [];

  const delTopic = async (id) => { if (confirm(t("confirmDeleteTopic"))) { await api.del(`/admin/path/topics/${id}`); toast(t("saved")); load(); } };
  const delNode = async (id) => { if (confirm(t("confirmDelete"))) { await api.del(`/admin/path/nodes/${id}`); toast(t("saved")); load(); } };

  // ---- drag & drop: reorder subjects ----
  const onTopicDrop = async (targetId) => {
    if (dragTopic == null || dragTopic === targetId) { setDragTopic(null); return; }
    const ids = data.topics.map((t) => t.id);
    const from = ids.indexOf(dragTopic), to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragTopic(null);
    // optimistic reorder
    setData((d) => ({ ...d, topics: ids.map((id) => d.topics.find((t) => t.id === id)) }));
    await api.put("/admin/path/reorder", { order: ids });
    toast(t("saved"));
  };
  // ---- drag & drop: reorder lessons within a subject ----
  const onNodeDrop = async (topicId, targetNodeId) => {
    if (!dragNode || dragNode.topicId !== topicId || dragNode.nodeId === targetNodeId) { setDragNode(null); return; }
    const topic = data.topics.find((t) => t.id === topicId);
    const ids = topic.nodes.map((n) => n.id);
    const from = ids.indexOf(dragNode.nodeId), to = ids.indexOf(targetNodeId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragNode(null);
    setData((d) => ({ ...d, topics: d.topics.map((t) => t.id === topicId ? { ...t, nodes: ids.map((id) => t.nodes.find((n) => n.id === id)) } : t) }));
    await api.put(`/admin/path/topics/${topicId}/reorder`, { order: ids });
    toast(t("saved"));
  };

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="book" size={22} /> {t("pathManager")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-accent btn-sm" onClick={() => setOfficialImport(true)}><Icon name="download" size={14} /> {lang === "fa" ? "ورود سؤال‌های رسمی/سال‌های قبل" : "Import past-exam questions"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setTopicEdit({ program })}><Icon name="book" size={14} /> {t("newTopic")}</button>
        </div>
      </div>
      <div className="muted small mb16">{t("pathManagerHint")}</div>
      <div className="card mb16" style={{ borderInlineStart: "4px solid var(--primary)", padding: "10px 14px" }}>
        {t("pathBilingualHint")}
      </div>

      {/* Program (course) tabs — manage each Duolingo-style course separately */}
      {programs.length > 1 && (
        <div className="ad-slot-tabs mb16">
          {programs.map((p) => (
            <button key={p.slug} className={`btn btn-sm ${program === p.slug ? "btn-primary" : "btn-ghost"}`} onClick={() => setProgram(p.slug)}>
              <span style={{ fontSize: "1.05rem" }}>{p.emoji}</span> {lang === "fa" ? p.fa : p.en} ({p.topics})
            </button>
          ))}
        </div>
      )}

      {data.topics.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="book" size={40} /></div><h3>{t("noData")}</h3></div>}

      <div className="muted small mb8" style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="menu" size={14} /> {t("dragToReorder")}</div>
      {data.topics.map((topic) => (
        <div className={`card mb8 ${dragTopic === topic.id ? "pm-dragging" : ""}`} key={topic.id}
          draggable
          onDragStart={(e) => { setDragTopic(topic.id); e.stopPropagation(); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onTopicDrop(topic.id); }}>
          <div className="pm-topic" onClick={() => setOpen((s) => ({ ...s, [topic.id]: !s[topic.id] }))} style={{ cursor: "pointer" }}>
            <span className="pm-drag" title={t("dragToReorder")}><Icon name="menu" size={16} /></span>
            <div className="pm-topic-ico" style={{ background: topic.color }}>
              {topic.emoji ? <span className="node-emoji" style={{ fontSize: "1.3rem" }}>{topic.emoji}</span> : <Icon name={topic.icon} size={20} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{lang === "en" ? (topic.name_en || topic.name_fa) : (topic.name_fa || topic.name_en)}</div>
              <div className="small muted">{topic.nodes.length} {t("lessonsCount")} · {topic.slug}</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setTopicEdit(topic); }} title={t("edit")}><Icon name="edit" size={13} /></button>
            <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); delTopic(topic.id); }} title={t("delete")}><Icon name="trash" size={13} /></button>
            <Icon name={open[topic.id] ? "chevronUp" : "chevronDown"} size={16} />
          </div>

          {open[topic.id] && (
            <div className="pm-nodes">
              {topic.nodes.map((n) => (
                <div className={`pm-node ${dragNode?.nodeId === n.id ? "pm-dragging" : ""}`} key={n.id}
                  draggable
                  onDragStart={(e) => { setDragNode({ topicId: topic.id, nodeId: n.id }); e.stopPropagation(); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onNodeDrop(topic.id, n.id); }}>
                  <span className="pm-drag" title={t("dragToReorder")}><Icon name="menu" size={14} /></span>
                  <span className="node-emoji" style={{ fontSize: "1.1rem" }}>{n.emoji || topic.emoji || "📘"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{lang === "fa" ? n.title_fa : n.title_en || "—"}</div>
                    <div className="small muted">{n.cardCount} {t("questionsCount")} · {n.xp_reward} XP · {t(n.kind)}</div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setCardsFor({ ...n, topicName: lang === "fa" ? topic.name_fa : topic.name_en })} title={t("chooseQuestions")}><Icon name="check" size={13} /></button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDesignFor(n)} title={t("designQuestion")}><Icon name="edit" size={13} /> +</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setNodeEdit(n)} title={t("edit")}><Icon name="settings" size={13} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => delNode(n.id)} title={t("delete")}><Icon name="trash" size={13} /></button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm mt8" onClick={() => setNodeEdit({ topic_id: topic.id, kind: "lesson", xp_reward: 20 })}>
                + {t("newLesson")}
              </button>
            </div>
          )}
        </div>
      ))}

      {topicEdit && <TopicModal topic={topicEdit} onClose={() => setTopicEdit(null)} onSaved={() => { setTopicEdit(null); toast(t("saved")); load(); }} />}
      {nodeEdit && <NodeModal node={nodeEdit} onClose={() => setNodeEdit(null)} onSaved={() => { setNodeEdit(null); toast(t("saved")); load(); }} />}
      {cardsFor && <CardsModal node={cardsFor} onClose={() => setCardsFor(null)} onSaved={() => { setCardsFor(null); toast(t("saved")); load(); }} />}
      {designFor && <DesignModal node={designFor} onClose={() => setDesignFor(null)} onSaved={() => { setDesignFor(null); toast(t("saved")); load(); }} />}
      {officialImport && <OfficialQuestionImportModal program={program} onClose={() => setOfficialImport(false)} onImported={() => { setOfficialImport(false); toast(t("saved")); load(); }} />}
    </div>
  );
}


function OfficialQuestionImportModal({ program, onClose, onImported }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [text, setText] = useState(`{
  "program": "${program || "preint"}",
  "exam_type": "residency_or_preinternship",
  "year": "1404",
  "source": "official past exam / reviewed source",
  "license": "public_past_exam_review_required",
  "maxPerLesson": 15,
  "overflowToPremium": false,
  "questions": [
    {
      "year": "1404",
      "exam_type": "residency",
      "subject_fa": "مغز و اعصاب",
      "subject_en": "Neurology",
      "chapter_fa": "سکته مغزی",
      "chapter_en": "Stroke",
      "question_no": 1,
      "question_fa": "متن سؤال مجاز/رسمی را اینجا وارد کنید...",
      "question_en": "English translation goes here...",
      "options_fa": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
      "options_en": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_index": 0,
      "explanation_fa": "پاسخ تشریحی تألیفی بر اساس رفرنس...",
      "explanation_en": "Original explanation based on references...",
      "hints_fa": ["هینت ۱"],
      "hints_en": ["Hint 1"],
      "difficulty": "medium"
    }
  ]
}`);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const parse = () => JSON.parse(text);
  const dryRun = async () => { setErr(""); try { setPreview(await api.post("/admin/official-question-import/preview", parse())); } catch (e) { setErr(e.message); } };
  const commit = async () => { setErr(""); try { const r = await api.post("/admin/official-question-import/commit", parse()); setPreview(r); onImported(); } catch (e) { setErr(e.message); } };
  return <Modal title={fa ? "ورود سؤال‌های رسمی/سال‌های قبل" : "Import past-exam questions"} onClose={onClose} wide>
    <div className="small muted mb8">{fa
      ? "ابتدا Dry-run بزنید. سؤال‌های تکراری مفهومی یا overflow به بانک پریمیوم می‌روند؛ مسیر رقابتی برای هر درس حداکثر ۱۵ سؤال می‌گیرد. فقط محتوایی را وارد کنید که مجوز استفاده/بازنشر آن روشن است."
      : "Run dry-run first. Concept duplicates/overflow go to premium; the competitive path receives at most 15 questions per lesson. Import only content you are allowed to use."}</div>
    {err && <div className="err-banner mb8">{err}</div>}
    <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", minHeight: 300, fontFamily: "monospace", fontSize: ".78rem" }} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <button className="btn btn-ghost" onClick={dryRun}>{fa ? "Dry-run / پیش‌نمایش" : "Dry-run / preview"}</button>
      <button className="btn btn-primary" onClick={commit} disabled={!preview}>{fa ? "ثبت نهایی import" : "Commit import"}</button>
    </div>
    {preview && <div className="card mt16" style={{ background: "var(--panel2)" }}>
      <h4>{fa ? "نتیجه" : "Result"}</h4>
      <div className="case-meta">
        <span className="tag">total: {preview.counters?.total ?? preview.inserted ?? 0}</span>
        <span className="tag">path: {preview.counters?.path ?? preview.attached ?? 0}</span>
        <span className="tag">premium: {preview.counters?.premium ?? 0}</span>
        <span className="tag">duplicate: {preview.counters?.duplicate ?? 0}</span>
      </div>
      {preview.plan && <div className="table-wrap mt8"><table><thead><tr><th>#</th><th>{fa ? "مسیر" : "Route"}</th><th>{fa ? "درس" : "Lesson"}</th><th>fp</th></tr></thead><tbody>{preview.plan.slice(0,80).map((p,i)=><tr key={i}><td>{p.question_no || i+1}</td><td>{p.route || p.error}</td><td>{p.node_title_fa || p.chapter_fa || "—"}</td><td className="small muted">{String(p.fingerprint||"").slice(0,36)}</td></tr>)}</tbody></table></div>}
    </div>}
  </Modal>;
}

function TopicModal({ topic, onClose, onSaved }) {
  const { t } = useApp();
  const [f, setF] = useState({
    slug: topic.slug || "", name_fa: topic.name_fa || "", name_en: topic.name_en || "",
    parent: topic.parent || "major", budget: topic.budget || 0, color: topic.color || "#2f7fd1",
    emoji: topic.emoji || "", icon: topic.icon || "flask", program: topic.program || "preint",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (topic.id) await api.put(`/admin/path/topics/${topic.id}`, f);
    else await api.post("/admin/path/topics", f);
    onSaved();
  };
  return (
    <Modal title={topic.id ? t("editTopic") : t("newTopic")} onClose={onClose} onSave={save}>
      {!topic.id && <div className="field"><label>{t("slug")} (لاتین، یکتا)</label>
        <input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="e.g. cardio" style={{ direction: "ltr" }} /></div>}
      <div className="grid grid-2">
        <div className="field"><label>{t("name")} (FA)</label><input value={f.name_fa} onChange={(e) => set("name_fa", e.target.value)} /></div>
        <div className="field"><label>{t("name")} (EN)</label><input value={f.name_en} onChange={(e) => set("name_en", e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("emoji")}</label><input value={f.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="🫀" style={{ direction: "ltr" }} /></div>
        <div className="field"><label>{t("budgetQuestions")}</label><input type="number" value={f.budget} onChange={(e) => set("budget", +e.target.value || 0)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("group")}</label>
          <select value={f.parent} onChange={(e) => set("parent", e.target.value)}>
            <option value="major">{t("majorSubjects")}</option>
            <option value="minor">{t("minorSubjects")}</option>
            <option value="internal">{t("internalGroup")}</option>
            <option value="floating">{t("floatingSubjects")}</option>
          </select></div>
        <div className="field"><label>{t("program")}</label>
          <select value={f.program} onChange={(e) => set("program", e.target.value)}>
            <option value="preint">{t("programPreint")}</option>
            <option value="basic">{t("programBasic")}</option>
          </select></div>
      </div>
      <div className="field"><label>{t("color")}</label><input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} /></div>
    </Modal>
  );
}

function NodeModal({ node, onClose, onSaved }) {
  const { t } = useApp();
  const [f, setF] = useState({
    title_fa: node.title_fa || "", title_en: node.title_en || "",
    kind: node.kind || "lesson", xp_reward: node.xp_reward || 20, emoji: node.emoji || "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (node.id) await api.put(`/admin/path/nodes/${node.id}`, f);
    else await api.post("/admin/path/nodes", { ...f, topic_id: node.topic_id });
    onSaved();
  };
  return (
    <Modal title={node.id ? t("editLesson") : t("newLesson")} onClose={onClose} onSave={save}>
      <div className="grid grid-2">
        <div className="field"><label>{t("title")} (FA)</label><input value={f.title_fa} onChange={(e) => set("title_fa", e.target.value)} /></div>
        <div className="field"><label>{t("title")} (EN)</label><input value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{t("emoji")}</label><input value={f.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="💊" style={{ direction: "ltr" }} /></div>
        <div className="field"><label>XP</label><input type="number" value={f.xp_reward} onChange={(e) => set("xp_reward", +e.target.value || 20)} /></div>
      </div>
      <div className="field"><label>{t("lessonType")}</label>
        <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
          <option value="lesson">{t("lesson")}</option>
          <option value="checkpoint">{t("checkpoint")}</option>
          <option value="boss">{t("boss")}</option>
        </select></div>
    </Modal>
  );
}

/* choose which existing questions this lesson contains */
function EditBankCardModal({ card, onClose, onSaved }) {
  const { lang } = useApp();
  const [f, setF] = useState({
    q_fa: card.q_fa || card.title_fa || "",
    q_en: card.q_en || card.title_en || "",
    difficulty: card.difficulty || "medium",
    options: (card.options && card.options.length ? card.options : [
      { fa: "", en: "", correct: true }, { fa: "", en: "", correct: false },
      { fa: "", en: "", correct: false }, { fa: "", en: "", correct: false }
    ]).map((o) => ({ fa: o.fa || "", en: o.en || o.fa || "", correct: !!o.correct, why_fa: o.why_fa || "" })),
    explanation_fa: card.explain?.fa || card.explanation_fa || "",
  });
  const [saving, setSaving] = useState(false);
  const setOpt = (i, k, v) => setF((s) => ({ ...s, options: s.options.map((o, j) => j === i ? { ...o, [k]: v } : o) }));
  const setCorrect = (i) => setF((s) => ({ ...s, options: s.options.map((o, j) => ({ ...o, correct: j === i })) }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...card,
        q_fa: f.q_fa,
        title_fa: f.q_fa,
        q_en: f.q_en,
        title_en: f.q_en,
        difficulty: f.difficulty,
        options: f.options,
        explain: { fa: f.explanation_fa, en: card.explain?.en || "" },
        explanation_fa: f.explanation_fa,
      };
      await api.put(`/flashcards/${card.id}`, payload);
      onSaved(payload);
      onClose();
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`${lang === "fa" ? "ویرایش سؤال در بانک" : "Edit Question in Bank"} #${card.id}`} onClose={onClose} onSave={save} saveText={saving ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : undefined}>
      <div className="field">
        <label>{lang === "fa" ? "متن سؤال (فارسی)" : "Question text (FA)"}</label>
        <textarea rows={3} value={f.q_fa} onChange={(e) => setF((s) => ({ ...s, q_fa: e.target.value }))} dir="rtl" />
      </div>
      <div className="field">
        <label>{lang === "fa" ? "سطح دشواری" : "Difficulty"}</label>
        <select value={f.difficulty} onChange={(e) => setF((s) => ({ ...s, difficulty: e.target.value }))}>
          <option value="easy">{lang === "fa" ? "ساده" : "Easy"}</option>
          <option value="medium">{lang === "fa" ? "متوسط" : "Medium"}</option>
          <option value="hard">{lang === "fa" ? "دشوار" : "Hard"}</option>
        </select>
      </div>
      <div className="field">
        <label>{lang === "fa" ? "گزینه‌ها و دلیل رد/تأیید" : "Options & Rationales"}</label>
        {f.options.map((o, i) => (
          <div key={i} className="card p8 mb8" style={{ background: "var(--panel2)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" name="correctOpt" checked={o.correct} onChange={() => setCorrect(i)} style={{ width: 18, height: 18 }} />
              <b style={{ color: o.correct ? "var(--green)" : undefined }}>
                {optionLetter(i, lang)} {o.correct ? (lang === "fa" ? "(گزینه صحیح)" : "(Correct)") : ""}
              </b>
              <input
                style={{ flex: 1 }}
                value={o.fa}
                onChange={(e) => setOpt(i, "fa", e.target.value)}
                placeholder={`${lang === "fa" ? "متن گزینه" : "Option text"} ${optionLetter(i, lang)}`}
                dir="rtl"
              />
            </div>
            <input
              style={{ width: "100%", fontSize: "0.85rem" }}
              value={o.why_fa || ""}
              onChange={(e) => setOpt(i, "why_fa", e.target.value)}
              placeholder={lang === "fa" ? "دلیل رد یا تأیید این گزینه (بالینی)..." : "Rationale for this option..."}
              dir="rtl"
            />
          </div>
        ))}
      </div>
      <div className="field">
        <label>{lang === "fa" ? "توضیح و تحلیل کلی سؤال" : "Overall Explanation"}</label>
        <textarea rows={3} value={f.explanation_fa} onChange={(e) => setF((s) => ({ ...s, explanation_fa: e.target.value }))} dir="rtl" />
      </div>
    </Modal>
  );
}

function CardsModal({ node, onClose, onSaved }) {
  const { t, lang } = useApp();
  const [all, setAll] = useState(null);
  const [sel, setSel] = useState(node.cardIds || []);
  const [q, setQ] = useState("");
  const [editingCard, setEditingCard] = useState(null);
  const [loadingCardId, setLoadingCardId] = useState(null);

  useEffect(() => { api.get("/admin/path/cards").then((d) => setAll(d.cards)).catch(() => setAll([])); }, []);
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const save = async () => { await api.put(`/admin/path/nodes/${node.id}`, { cardIds: sel }); onSaved(); };
  const needle = q.trim().toLowerCase();
  const list = (all || []).filter((c) => !needle || String(c.q).toLowerCase().includes(needle) || String(c.id).includes(needle));

  const openCardEditor = async (id) => {
    try {
      setLoadingCardId(id);
      const card = await api.get(`/flashcards/${id}`);
      setEditingCard(card);
    } catch (e) {
      alert(e.message || "Failed to load card");
    } finally {
      setLoadingCardId(null);
    }
  };

  const handleCardSaved = (updatedCard) => {
    setAll((prev) => (prev || []).map((c) => c.id === updatedCard.id ? { ...c, q: updatedCard.q_fa || updatedCard.title_fa || c.q } : c));
  };

  return (
    <>
      <Modal title={`${t("chooseQuestions")} — ${node.topicName || ""}`} onClose={onClose} onSave={save}>
        {!all ? <Spinner /> : (<>
          <div className="dt-search"><Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} /></div>
          <div className="small muted mb8">{sel.length} {t("selected")}</div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {list.map((c) => (
              <div key={c.id} className="toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px" }}>
                <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggle(c.id)}>
                  <span className="tag" style={{ marginInlineEnd: 6 }}>{t(c.type)}</span>
                  {c.q}
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                  title={lang === "fa" ? "ویرایش مستقیم این سؤال در بانک سؤالات" : "Edit directly in question bank"}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCardEditor(c.id); }}
                  disabled={loadingCardId === c.id}
                >
                  <Icon name="edit" size={12} /> {loadingCardId === c.id ? (lang === "fa" ? "..." : "...") : (lang === "fa" ? "ویرایش در بانک" : "Edit in Bank")}
                </button>
              </div>
            ))}
            {list.length === 0 && <div className="small muted center" style={{ padding: 16 }}>{t("noData")}</div>}
          </div>
        </>)}
      </Modal>
      {editingCard && <EditBankCardModal card={editingCard} onClose={() => setEditingCard(null)} onSaved={handleCardSaved} />}
    </>
  );
}

/* design a brand-new MCQ question attached to this lesson */
function DesignModal({ node, onClose, onSaved }) {
  const { t } = useApp();
  const [f, setF] = useState({
    type: "mcq", q_fa: "", q_en: "", difficulty: "medium",
    options: [{ fa: "", correct: true }, { fa: "", correct: false }, { fa: "", correct: false }, { fa: "", correct: false }],
    answer: true, hints_fa: "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setOpt = (i, k, v) => setF((s) => { const o = [...s.options]; o[i] = { ...o[i], [k]: v }; return { ...s, options: o }; });
  const setCorrect = (i) => setF((s) => ({ ...s, options: s.options.map((o, j) => ({ ...o, correct: j === i })) }));
  const save = async () => {
    const payload = {
      type: f.type, q_fa: f.q_fa, q_en: f.q_en, difficulty: f.difficulty, node_id: node.id,
      hints_fa: f.hints_fa ? f.hints_fa.split("\n").filter(Boolean) : [],
    };
    if (f.type === "mcq") payload.options = f.options.filter((o) => o.fa.trim());
    else if (f.type === "truefalse") payload.answer = f.answer;
    await api.post("/admin/path/questions", payload);
    onSaved();
  };
  return (
    <Modal title={t("designQuestion")} onClose={onClose} onSave={save}>
      <div className="field"><label>{t("questionTypeLabel")}</label>
        <select value={f.type} onChange={(e) => set("type", e.target.value)}>
          <option value="mcq">{t("qtMcq")}</option>
          <option value="truefalse">{t("qtTruefalse")}</option>
        </select></div>
      <div className="field"><label>{t("questionText")} (FA)</label><textarea value={f.q_fa} onChange={(e) => set("q_fa", e.target.value)} /></div>
      <div className="field"><label>{t("questionText")} (EN)</label><textarea value={f.q_en} onChange={(e) => set("q_en", e.target.value)} /></div>

      {f.type === "mcq" && (
        <div className="field"><label>{t("options")} ({t("tapCorrect")})</label>
          {f.options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" checked={o.correct} onChange={() => setCorrect(i)} style={{ width: 18, height: 18 }} />
              <input value={o.fa} onChange={(e) => setOpt(i, "fa", e.target.value)} placeholder={`${t("option")} ${i + 1}`} style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      )}
      {f.type === "truefalse" && (
        <div className="field"><label>{t("correctAnswer")}</label>
          <select value={f.answer ? "t" : "f"} onChange={(e) => set("answer", e.target.value === "t")}>
            <option value="t">{t("true")}</option><option value="f">{t("false")}</option>
          </select></div>
      )}
      <div className="field"><label>{t("difficulty")}</label>
        <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
          <option value="easy">{t("easy")}</option><option value="medium">{t("medium")}</option><option value="hard">{t("hard")}</option>
        </select></div>
      <div className="field"><label>{t("hints")}</label>
        <textarea value={f.hints_fa} onChange={(e) => set("hints_fa", e.target.value)} placeholder={t("hintsPlaceholder")} /></div>
    </Modal>
  );
}
