import { useEffect, useState, useMemo } from "react";
import { api } from "../../api.js";
import { useApp } from "../../context.jsx";
import Icon from "../../components/Icon.jsx";

/* MindMap Bank Admin — جذاب، کاربردی، دوسویه
   - 349 نقشه، فیلترهای faceted، جستجوی زنده
   - کارت‌های شیشه‌ای با گرادیانِ سیستمی
   - ویرایشِ کامل + پیش‌نمایش گراف
   - اتصال دوسویه به بانک سؤال (همان جدول question_mindmap_links)
     • از سمتِ مایندمپ: جستجو و اتصال سؤال → خودکار در سمتِ سؤال هم دیده می‌شود
     • از سمتِ سؤال (LearnCards): اتصال مایندمپ → خودکار در سمتِ مایندمپ هم دیده می‌شود
*/

const SYSTEMS = [
  { id: "cardio", label_fa: "قلب", label_en: "Cardio", icon: "❤️", color: "#e11d48", grad: "from-rose-500 to-pink-600" },
  { id: "pulmo", label_fa: "ریه", label_en: "Lung", icon: "🫁", color: "#0284c7", grad: "from-sky-500 to-blue-600" },
  { id: "gastro", label_fa: "گوارش", label_en: "GI", icon: "🍃", color: "#059669", grad: "from-emerald-500 to-teal-600" },
  { id: "nephro", label_fa: "کلیه", label_en: "Kidney", icon: "🫘", color: "#7c3aed", grad: "from-violet-500 to-purple-600" },
  { id: "endo", label_fa: "غدد", label_en: "Endo", icon: "🧬", color: "#d97706", grad: "from-amber-500 to-orange-600" },
  { id: "neuro", label_fa: "مغز", label_en: "Neuro", icon: "🧠", color: "#0891b2", grad: "from-cyan-500 to-teal-600" },
  { id: "heme", label_fa: "خون", label_en: "Heme", icon: "🩸", color: "#dc2626", grad: "from-red-600 to-rose-700" },
  { id: "rheum", label_fa: "روماتو", label_en: "Rheum", icon: "🦴", color: "#a855f7", grad: "from-fuchsia-500 to-purple-600" },
  { id: "infect", label_fa: "عفونی", label_en: "Infect", icon: "🦠", color: "#16a34a", grad: "from-green-500 to-emerald-600" },
  { id: "emergency", label_fa: "اورژانس", label_en: "Emerg", icon: "🚨", color: "#ef4444", grad: "from-red-500 to-orange-600" },
  { id: "peds", label_fa: "کودکان", label_en: "Peds", icon: "👶", color: "#ec4899", grad: "from-pink-500 to-rose-600" },
  { id: "obgyn", label_fa: "زنان", label_en: "OB-GYN", icon: "🤰", color: "#e11d48", grad: "from-rose-500 to-red-600" },
  { id: "surgery", label_fa: "جراحی", label_en: "Surgery", icon: "🔪", color: "#dc2626", grad: "from-red-500 to-rose-600" },
  { id: "path", label_fa: "پاتولوژی", label_en: "Path", icon: "🧫", color: "#9333ea", grad: "from-purple-500 to-violet-600" },
  { id: "pharm", label_fa: "دارو", label_en: "Pharm", icon: "💊", color: "#0ea5e9", grad: "from-sky-500 to-blue-600" },
  { id: "radio", label_fa: "رادیولوژی", label_en: "Radio", icon: "📷", color: "#64748b", grad: "from-slate-500 to-gray-600" },
  { id: "ent", label_fa: "گوش‌حلق", label_en: "ENT", icon: "👃", color: "#14b8a6", grad: "from-teal-500 to-emerald-600" },
  { id: "uro", label_fa: "اورولوژی", label_en: "Uro", icon: "🚹", color: "#2563eb", grad: "from-blue-500 to-indigo-600" },
  { id: "ortho", label_fa: "ارتوپدی", label_en: "Ortho", icon: "🦿", color: "#f59e0b", grad: "from-amber-500 to-orange-600" },
  { id: "psych", label_fa: "روان", label_en: "Psych", icon: "🎭", color: "#8b5cf6", grad: "from-violet-500 to-purple-600" },
  { id: "derm", label_fa: "پوست", label_en: "Derm", icon: "🖐️", color: "#f97316", grad: "from-orange-500 to-amber-600" },
  { id: "ophth", label_fa: "چشم", label_en: "Eye", icon: "👁️", color: "#06b6d4", grad: "from-cyan-500 to-blue-600" },
  { id: "stats", label_fa: "آمار", label_en: "Stats", icon: "📊", color: "#16a34a", grad: "from-green-500 to-teal-600" },
  { id: "ethics", label_fa: "اخلاق", label_en: "Ethics", icon: "⚖️", color: "#334155", grad: "from-slate-600 to-slate-700" },
  { id: "immuno", label_fa: "ایمنی", label_en: "Immune", icon: "🛡️", color: "#22c55e", grad: "from-green-500 to-emerald-600" },
  { id: "nutrition", label_fa: "تغذیه", label_en: "Nutr", icon: "🥗", color: "#84cc16", grad: "from-lime-500 to-green-600" },
  { id: "genetics", label_fa: "ژنتیک", label_en: "Gen", icon: "🧬", color: "#db2777", grad: "from-pink-500 to-rose-500" },
  { id: "anatomy", label_fa: "آناتومی", label_en: "Anatomy", icon: "🧍", color: "#ea580c", grad: "from-orange-500 to-red-500" },
  { id: "physio", label_fa: "فیزیولوژی", label_en: "Physio", icon: "⚡", color: "#06b6d4", grad: "from-cyan-500 to-blue-500" },
  { id: "biochem", label_fa: "بیوشیمی", label_en: "Biochem", icon: "🧪", color: "#8b5cf6", grad: "from-violet-500 to-purple-600" },
  { id: "histology", label_fa: "بافت‌شناسی", label_en: "Histology", icon: "🔬", color: "#ec4899", grad: "from-pink-500 to-rose-500" },
  { id: "embryo", label_fa: "جنین‌شناسی", label_en: "Embryo", icon: "🌱", color: "#22c55e", grad: "from-green-500 to-emerald-600" },
  { id: "micro", label_fa: "میکروب", label_en: "Micro", icon: "👾", color: "#14b8a6", grad: "from-teal-500 to-cyan-600" },
  { id: "biophys", label_fa: "بیوفیزیک", label_en: "Biophys", icon: "🔭", color: "#6366f1", grad: "from-indigo-500 to-violet-600" },
  { id: "physics", label_fa: "فیزیک", label_en: "Phys", icon: "⚛️", color: "#6366f1", grad: "from-indigo-500 to-violet-600" },
  { id: "other", label_fa: "سایر", label_en: "Other", icon: "✨", color: "#64748b", grad: "from-slate-500 to-gray-600" },
];
function sysMeta(id) { return SYSTEMS.find(s => s.id === id) || SYSTEMS[SYSTEMS.length - 1]; }
function branchStyle(b) {
  const m = {
    definition: { bg: "#dbeafe", fg: "#1e40af", icon: "📖", label: "تعریف" },
    etiology: { bg: "#f3e8ff", fg: "#7c3aed", icon: "🔍", label: "علت" },
    patho: { bg: "#fee2e2", fg: "#dc2626", icon: "⚙️", label: "پاتوفیزیو" },
    clinical: { bg: "#ffedd5", fg: "#ea580c", icon: "🩺", label: "بالینی" },
    workup: { bg: "#e0f2fe", fg: "#0369a1", icon: "🔬", label: "بررسی" },
    treatment: { bg: "#dcfce7", fg: "#15803d", icon: "💊", label: "درمان" },
    complication: { bg: "#fecaca", fg: "#991b1b", icon: "⚠️", label: "عارضه" },
    ddx: { bg: "#f3e8ff", fg: "#6b21a8", icon: "🔀", label: "افتراقی" },
    start: { bg: "#dbeafe", fg: "#1e3a8a", icon: "🚀", label: "شروع" },
    question: { bg: "#fef3c7", fg: "#7c2d12", icon: "❓", label: "سؤال" },
    action: { bg: "#dcfce7", fg: "#14532d", icon: "✅", label: "اقدام" },
  };
  return m[b] || { bg: "#f1f5f9", fg: "#334155", icon: "•", label: b };
}

export default function MindmapBankAdmin() {
  const { lang } = useApp();
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [filterSys, setFilterSys] = useState([]);
  const [filterType, setFilterType] = useState([]);
  const [filterLevel, setFilterLevel] = useState([]);
  const [filterPremium, setFilterPremium] = useState([]);
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ slug: "", title_fa: "", title_en: "", type: "mind", system: "cardio", level: "core", summary_fa: "", summary_en: "", cover_url: "/covers/harrison.jpg", graph_json: '{\n  "nodes": [\n    { "id": "def", "label_fa": "تعریف", "label_en": "Def", "branch": "definition", "x": 0, "y": 0 },\n    { "id": "eti", "label_fa": "اتیولوژی", "label_en": "Etiology", "branch": "etiology", "x": -220, "y": 110 },\n    { "id": "clin", "label_fa": "تظاهر", "label_en": "Clinical", "branch": "clinical", "x": 220, "y": 110 },\n    { "id": "workup", "label_fa": "بررسی", "label_en": "Workup", "branch": "workup", "x": -220, "y": 230 },\n    { "id": "rx", "label_fa": "درمان", "label_en": "Rx", "branch": "treatment", "x": 220, "y": 230 }\n  ],\n  "edges": [\n    { "from": "def", "to": "eti", "label": "" },\n    { "from": "eti", "to": "clin", "label": "" },\n    { "from": "clin", "to": "workup", "label": "" },\n    { "from": "workup", "to": "rx", "label": "" }\n  ]\n}', is_premium: 1, status: "active" });
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState(null);
  const [linking, setLinking] = useState({ open: false, slug: null, graphNodes: [], linked: [], search: "", searchRes: [], selectedQ: null, node: "", weight: 1 });
  const isFa = lang === "fa";

  // debounce search
  useEffect(() => { const id = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(id); }, [qInput]);
  useEffect(() => setPage(1), [q, filterSys, filterType, filterLevel, filterPremium, sort]);

  const toggle = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "20", sort, lang });
    if (q) qs.set("q", q);
    if (filterSys.length) qs.set("system", filterSys.join(","));
    if (filterType.length) qs.set("type", filterType.join(","));
    if (filterLevel.length) qs.set("level", filterLevel.join(","));
    if (filterPremium.length) qs.set("premium", filterPremium.join(","));
    api.get(`/admin/mindmap-bank?${qs.toString()}`).then(d => setData(d)).catch(() => setData({ items: [], total: 0 }));
  };
  useEffect(load, [q, filterSys, filterType, filterLevel, filterPremium, sort, page, lang]);

  const openEdit = async (slug) => {
    if (slug) {
      const row = await api.get(`/admin/mindmap-bank/${slug}`);
      setEditing(slug);
      let gj = row.graph_json;
      if (typeof gj !== "string") gj = JSON.stringify(gj, null, 2);
      setForm({
        slug: row.slug, title_fa: row.title_fa, title_en: row.title_en, type: row.type, system: row.system, level: row.level,
        summary_fa: row.summary_fa || "", summary_en: row.summary_en || "", cover_url: row.cover_url || "/covers/harrison.jpg",
        graph_json: gj, is_premium: row.is_premium ? 1 : 0, status: row.status || "active"
      });
      setDetail(row);
      // load links
      setLinking(l => ({ ...l, slug, graphNodes: (() => { try { const g = typeof row.graph_json === "string" ? JSON.parse(row.graph_json) : row.graph_json; return g.nodes || []; } catch { return []; } })(), linked: row.linkedQuestions || [] }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setEditing(null);
      setForm({ slug: "", title_fa: "", title_en: "", type: "mind", system: "cardio", level: "core", summary_fa: "", summary_en: "", cover_url: "/covers/harrison.jpg", graph_json: '{\n  "nodes": [\n    { "id": "def", "label_fa": "تعریف", "label_en": "Def", "branch": "definition", "x": 0, "y": 0 },\n    { "id": "eti", "label_fa": "اتیولوژی", "label_en": "Etiology", "branch": "etiology", "x": -220, "y": 110 },\n    { "id": "clin", "label_fa": "تظاهر", "label_en": "Clinical", "branch": "clinical", "x": 220, "y": 110 },\n    { "id": "workup", "label_fa": "بررسی", "label_en": "Workup", "branch": "workup", "x": -220, "y": 230 },\n    { "id": "rx", "label_fa": "درمان", "label_en": "Rx", "branch": "treatment", "x": 220, "y": 230 }\n  ],\n  "edges": [\n    { "from": "def", "to": "eti", "label": "" },\n    { "from": "eti", "to": "clin", "label": "" },\n    { "from": "clin", "to": "workup", "label": "" },\n    { "from": "workup", "to": "rx", "label": "" }\n  ]\n}', is_premium: 1, status: "active" });
      setDetail(null);
      setLinking({ open: false, slug: null, graphNodes: [], linked: [], search: "", searchRes: [], selectedQ: null, node: "", weight: 1 });
    }
  };

  const save = async () => {
    try {
      const payload = { ...form, graph_json: JSON.parse(form.graph_json) };
      if (editing) await api.post(`/admin/mindmap-bank`, { ...payload, slug: editing });
      else await api.post("/admin/mindmap-bank", payload);
      setMsg(isFa ? "ذخیره شد ✓" : "Saved ✓");
      setTimeout(() => setMsg(""), 2500);
      openEdit(null);
      load();
    } catch (e) { setMsg(String(e.message || e)); }
  };
  const del = async (slug) => {
    if (!confirm(isFa ? `حذف ${slug}؟` : `Delete ${slug}?`)) return;
    await api.del(`/admin/mindmap-bank/${slug}`); load();
  };
  const dup = async (slug) => {
    const newSlug = prompt(isFa ? `نامِ جدید برای کپیِ ${slug}` : `New slug for copy of ${slug}`, `${slug}-copy`);
    if (!newSlug) return;
    try {
      const row = await api.get(`/admin/mindmap-bank/${slug}`);
      const g = typeof row.graph_json === "string" ? JSON.parse(row.graph_json) : row.graph_json;
      await api.post("/admin/mindmap-bank", { slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"), title_fa: row.title_fa + " — کپی", title_en: row.title_en + " (copy)", type: row.type, system: row.system, level: row.level, summary_fa: row.summary_fa, summary_en: row.summary_en, cover_url: row.cover_url, graph_json: g, is_premium: row.is_premium ? 1 : 0, status: row.status });
      setMsg(isFa ? "کپی شد ✓" : "Duplicated ✓"); setTimeout(() => setMsg(""), 2000); load();
    } catch (e) { setMsg(String(e.message || e)); }
  };
  const seed = async () => {
    const r = await api.post("/admin/mindmap-bank/seed", {});
    setMsg(`seeded ${r.seeded} total ${r.total}`);
    load();
  };

  // linking helpers
  const refreshLinks = async (slug) => {
    const r = await api.get(`/admin/mindmap-bank/${slug}/links`);
    setLinking(l => ({ ...l, linked: r.links || [] }));
  };
  const searchQuestions = async () => {
    if (!linking.search.trim()) return;
    // fetch cards and filter locally (fast for 11k)
    const d = await api.get(`/admin/learn-cards?lang=${lang}`);
    const kw = linking.search.trim().toLowerCase();
    const filtered = (d.cards || []).filter(c => {
      const hay = `${c.q} ${c.id} ${c.subject} ${c.facets?.chapter || ""} ${c.facets?.concept || ""}`.toLowerCase();
      return hay.includes(kw);
    }).slice(0, 12);
    setLinking(l => ({ ...l, searchRes: filtered }));
  };
  const doLink = async () => {
    if (!linking.slug || !linking.selectedQ) return;
    await api.post("/admin/mindmap-bank/link", { question_id: Number(linking.selectedQ), mindmap_slug: linking.slug, node_slug: linking.node || null, weight: Number(linking.weight) || 1 });
    setLinking(l => ({ ...l, selectedQ: null, node: "", weight: 1, search: "", searchRes: [] }));
    await refreshLinks(linking.slug);
    setMsg(isFa ? "اتصال برقرار شد ↔ دوسویه" : "Linked ↔ bidirectional");
    setTimeout(() => setMsg(""), 2000);
  };
  const doUnlink = async (qid) => {
    await api.post("/admin/mindmap-bank/unlink", { question_id: Number(qid), mindmap_slug: linking.slug });
    await refreshLinks(linking.slug);
  };

  const total = data?.total || 0;
  const facetCounts = data?.facetCounts || {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[20px] border border-violet-200 bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 p-6 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">🧠 {isFa ? "بانک مایندمپ — ۳۴۹" : "MindMap Bank — 349"}</h1>
            <p className="mt-1 text-sm text-violet-100">{isFa ? "تمام دروس + دوزبانه + اتصال دوسویه به بانک سؤال" : "All subjects, bilingual, bidirectional Qbank links"} • {total} {isFa ? "نقشه" : "maps"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/20 px-3 py-1 font-bold">Harrison 100</span>
              <span className="rounded-full bg-white/20 px-3 py-1 font-bold">Nelson/Williams/Schwartz/Robbins 221 + علومِ پایه 28</span>
              <span className="rounded-full bg-white px-3 py-1 font-black text-violet-700">FA/EN • 349</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEdit(null)} className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-violet-700 shadow hover:bg-violet-50">+ {isFa ? "مایندمپ جدید" : "New map"}</button>
            <button onClick={seed} className="rounded-full bg-violet-900/30 px-4 py-2.5 text-sm font-bold text-white border border-white/20 hover:bg-violet-900/50">↻ {isFa ? "Seed 349" : "Seed 349"}</button>
          </div>
        </div>
      </div>

      {/* Edit/Create */}
      <div className="mt-6 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">{editing ? (isFa ? `ویرایش: ${editing}` : `Edit: ${editing}`) : (isFa ? "ایجاد نقشهٔ جدید" : "Create new map")}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="slug (e.g. peds-neonate)" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none" />
          <select value={form.system} onChange={e => setForm({ ...form, system: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
            {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.id} — {isFa ? s.label_fa : s.label_en}</option>)}
          </select>
          <input value={form.title_fa} onChange={e => setForm({ ...form, title_fa: e.target.value })} placeholder="عنوان فارسی" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
          <input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} placeholder="Title EN" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"><option value="mind">🧠 mind</option><option value="approach">🧭 approach</option></select>
          <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"><option value="core">core</option><option value="high_yield">high_yield</option><option value="emergency">emergency</option></select>
          <select value={form.is_premium ? 1 : 0} onChange={e => setForm({ ...form, is_premium: Number(e.target.value) })} className="rounded-xl border px-3 py-2.5 text-sm"><option value={1}>🔒 premium</option><option value={0}>✓ free</option></select>
          <input value={form.cover_url} onChange={e => setForm({ ...form, cover_url: e.target.value })} placeholder="/covers/harrison.jpg" className="rounded-xl border px-3 py-2.5 text-sm" />
          <textarea value={form.summary_fa} onChange={e => setForm({ ...form, summary_fa: e.target.value })} placeholder="خلاصه فارسی — رفرنس اختصاصی (مثلاً Nelson 21e)" className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" rows={2} />
          <textarea value={form.summary_en} onChange={e => setForm({ ...form, summary_en: e.target.value })} placeholder="Summary EN — per Nelson/Williams/Schwartz..." className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" rows={2} />
          <textarea value={form.graph_json} onChange={e => setForm({ ...form, graph_json: e.target.value })} placeholder='{"nodes":[],"edges":[]}' className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2.5 font-mono text-xs text-emerald-300" rows={10} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={save} className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-black text-white shadow hover:bg-violet-700">{editing ? (isFa ? "به‌روزرسانی" : "Update") : (isFa ? "ایجاد" : "Create")}</button>
          {editing && <button onClick={() => openEdit(null)} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold">{isFa ? "لغو" : "Cancel"}</button>}
          <span className="ms-auto text-sm font-bold text-emerald-700">{msg}</span>
        </div>

        {/* Bidirectional linking panel */}
        {editing && (
          <div className="mt-6 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white">🔗</span> {isFa ? "اتصال دوسویه به بانک سؤال" : "Bidirectional Qbank links"} <span className="ms-auto rounded-full bg-white px-3 py-1 text-xs border">{linking.linked.length} {isFa ? "سؤال" : "Qs"}</span></h4>
            <p className="mt-1 text-xs text-slate-600">{isFa ? "هر اتصال از اینجا، خودکار در ویرایشِ سؤال هم دیده می‌شود و برعکس (یک جدول). " : "Every link here instantly appears when editing that question, and vice versa (single table)."} <span className="font-bold text-sky-700">↔ دوسویه</span></p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2 flex gap-2">
                <input value={linking.search} onChange={e => setLinking(l => ({ ...l, search: e.target.value }))} placeholder={isFa ? "جستجوی سؤال: مثلاً STEMI، پنومونی..." : "Search Q: STEMI, pneumonia..."} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                <button onClick={searchQuestions} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">🔎</button>
              </div>
              <select value={linking.node} onChange={e => setLinking(l => ({ ...l, node: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm">
                <option value="">{isFa ? "گره (اختیاری)" : "Node (optional)"}</option>
                {linking.graphNodes.map(n => <option key={n.id} value={n.id}>{n.id} — {isFa ? n.label_fa : n.label_en}</option>)}
              </select>
            </div>
            {linking.searchRes.length > 0 && (
              <div className="mt-3 grid gap-2">
                {linking.searchRes.map(c => (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 hover:border-sky-300 ${String(linking.selectedQ) === String(c.id) ? "ring-2 ring-sky-500 border-sky-500" : "border-slate-200"}`}>
                    <input type="radio" name="pickQ" checked={String(linking.selectedQ) === String(c.id)} onChange={() => setLinking(l => ({ ...l, selectedQ: c.id }))} />
                    <span className="text-sm"><b>#{c.id}</b> — {c.q?.slice(0, 110)} {c.facets?.chapter ? <span className="text-xs text-slate-500">({c.facets.chapter})</span> : null}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="number" min={1} max={99} value={linking.weight} onChange={e => setLinking(l => ({ ...l, weight: e.target.value }))} className="w-20 rounded-xl border px-3 py-2 text-sm" placeholder="weight" />
              <button disabled={!linking.selectedQ} onClick={doLink} className="rounded-full bg-sky-600 px-5 py-2 text-sm font-black text-white disabled:opacity-40 hover:bg-sky-700">🔗 {isFa ? "اتصال" : "Link"} {linking.selectedQ ? `#${linking.selectedQ}` : ""} ↔</button>
              <span className="text-xs text-slate-500">{isFa ? "وزن کمتر = اول نمایش" : "Lower weight → higher rank"}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {linking.linked.length === 0 ? <div className="rounded-xl border border-dashed bg-white/70 p-4 text-center text-sm text-slate-500">{isFa ? "هنوز سؤالی لینک نشده" : "No linked questions yet"}</div> : linking.linked.map(l => (
                <div key={l.question_id} className="flex items-center gap-3 rounded-xl border border-white bg-white p-3 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">#{l.question_id}</span>
                  <span className="flex-1 text-sm line-clamp-2">{l.q || `Q#${l.question_id}`} {l.node_slug ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">{l.node_slug}</span> : null}</span>
                  <span className="text-xs text-slate-500">w{l.weight}</span>
                  <button onClick={() => doUnlink(l.question_id)} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">✕ {isFa ? "قطع" : "Unlink"}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">🔎</span>
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder={isFa ? "جستجو: STEMI، نوزاد، جراحی..." : "Search: STEMI, neonate, surgery..."} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-10 pe-10 text-sm focus:border-violet-500 focus:bg-white focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SYSTEMS.slice(0, 20).map(s => {
              const active = filterSys.includes(s.id);
              const cnt = facetCounts.system?.[s.id] || 0;
              return <button key={s.id} onClick={() => toggle(filterSys, setFilterSys, s.id)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"}`}>{s.icon} {isFa ? s.label_fa : s.label_en} {cnt ? `(${cnt})` : ""}</button>;
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => toggle(filterType, setFilterType, "mind")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterType.includes("mind") ? "bg-indigo-600 text-white" : "bg-white"}`}>🧠 mind</button>
            <button onClick={() => toggle(filterType, setFilterType, "approach")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterType.includes("approach") ? "bg-amber-600 text-white" : "bg-white"}`}>🧭 approach</button>
            <button onClick={() => toggle(filterLevel, setFilterLevel, "core")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterLevel.includes("core") ? "bg-sky-600 text-white" : "bg-white"}`}>core</button>
            <button onClick={() => toggle(filterLevel, setFilterLevel, "high_yield")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterLevel.includes("high_yield") ? "bg-amber-600 text-white" : "bg-white"}`}>high_yield</button>
            <button onClick={() => toggle(filterPremium, setFilterPremium, "premium")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterPremium.includes("premium") ? "bg-slate-900 text-white" : "bg-white"}`}>🔒 premium</button>
            <button onClick={() => toggle(filterPremium, setFilterPremium, "free")} className={`rounded-full border px-3 py-1 text-xs font-bold ${filterPremium.includes("free") ? "bg-emerald-600 text-white" : "bg-white"}`}>✓ free</button>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">{total} {isFa ? "نقشه" : "maps"} • {data?.previews ?? 0} {isFa ? "پیش‌نمایش" : "previews"}</span>
            <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs">
              <option value="default">featured</option><option value="newest">newest</option><option value="nodes">most nodes</option><option value="title">A–Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {!data ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-[20px] bg-slate-200" />)}</div> : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {data.items.map(it => {
              const meta = sysMeta(it.system);
              return (
                <div key={it.slug} className="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg transition">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl text-white shadow" style={{ background: meta.color }}>{it.type === "approach" ? "🧭" : meta.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-black leading-tight">{isFa ? it.title_fa : it.title_en} <span className="font-normal text-slate-400">({it.slug})</span></div>
                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{isFa ? it.summary_fa : it.summary_en}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: meta.color }}>{meta.id}</span>
                        <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs">{it.level}</span>
                        <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs">{it.nodes?.length || 0} nodes</span>
                        {it.is_premium ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">🔒</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs">✓</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button onClick={() => openEdit(it.slug)} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">✏️ {isFa ? "ویرایش + لینک" : "Edit + link"}</button>
                    <button onClick={() => dup(it.slug)} className="rounded-full border bg-white px-3 py-1.5 text-xs">📋 {isFa ? "کپی" : "Duplicate"}</button>
                    <button onClick={() => del(it.slug)} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-full border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">←</button>
              <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">{page} / {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-full border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">→</button>
            </div>
          )}
        </>
      )}
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-xl">{msg}</div>}
    </div>
  );
}
