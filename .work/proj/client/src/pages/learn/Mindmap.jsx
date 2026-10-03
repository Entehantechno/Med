import { useEffect, useState, useMemo } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* MindMap Bank — 349 maps, premium + attractive UI
   - Glass cards, gradients, micro-animations, hover lift
   - Search + faceted chips with live counts
   - Graph: glass nodes, spring layout, mini-map
*/

const SYSTEMS = [
  { id: "cardio", label_fa: "قلب", label_en: "Cardio", icon: "❤️", grad: "from-rose-500 to-pink-600", color: "#e11d48" },
  { id: "pulmo", label_fa: "ریه", label_en: "Lung", icon: "🫁", grad: "from-sky-500 to-blue-600", color: "#0284c7" },
  { id: "gastro", label_fa: "گوارش", label_en: "GI", icon: "🍃", grad: "from-emerald-500 to-teal-600", color: "#059669" },
  { id: "nephro", label_fa: "کلیه", label_en: "Kidney", icon: "🫘", grad: "from-violet-500 to-purple-600", color: "#7c3aed" },
  { id: "endo", label_fa: "غدد", label_en: "Endo", icon: "🧬", grad: "from-amber-500 to-orange-600", color: "#d97706" },
  { id: "neuro", label_fa: "مغز", label_en: "Neuro", icon: "🧠", grad: "from-cyan-500 to-teal-600", color: "#0891b2" },
  { id: "heme", label_fa: "خون", label_en: "Heme", icon: "🩸", grad: "from-red-600 to-rose-700", color: "#dc2626" },
  { id: "rheum", label_fa: "روماتو", label_en: "Rheum", icon: "🦴", grad: "from-fuchsia-500 to-purple-600", color: "#a855f7" },
  { id: "infect", label_fa: "عفونی", label_en: "Infect", icon: "🦠", grad: "from-green-500 to-emerald-600", color: "#16a34a" },
  { id: "emergency", label_fa: "اورژانس", label_en: "Emerg", icon: "🚨", grad: "from-red-500 to-orange-600", color: "#ef4444" },
  { id: "peds", label_fa: "کودکان", label_en: "Peds", icon: "👶", grad: "from-pink-500 to-rose-600", color: "#ec4899" },
  { id: "obgyn", label_fa: "زنان", label_en: "OB-GYN", icon: "🤰", grad: "from-rose-500 to-red-600", color: "#e11d48" },
  { id: "surgery", label_fa: "جراحی", label_en: "Surgery", icon: "🔪", grad: "from-red-500 to-rose-600", color: "#dc2626" },
  { id: "path", label_fa: "پاتولوژی", label_en: "Path", icon: "🧫", grad: "from-purple-500 to-violet-600", color: "#9333ea" },
  { id: "pharm", label_fa: "دارو", label_en: "Pharm", icon: "💊", grad: "from-sky-500 to-blue-600", color: "#0ea5e9" },
  { id: "radio", label_fa: "رادیولوژی", label_en: "Radio", icon: "📷", grad: "from-slate-500 to-gray-600", color: "#64748b" },
  { id: "ent", label_fa: "گوش‌حلق", label_en: "ENT", icon: "👃", grad: "from-teal-500 to-emerald-600", color: "#14b8a6" },
  { id: "uro", label_fa: "اورولوژی", label_en: "Uro", icon: "🚹", grad: "from-blue-500 to-indigo-600", color: "#2563eb" },
  { id: "ortho", label_fa: "ارتوپدی", label_en: "Ortho", icon: "🦿", grad: "from-amber-500 to-orange-600", color: "#f59e0b" },
  { id: "psych", label_fa: "روان", label_en: "Psych", icon: "🎭", grad: "from-violet-500 to-purple-600", color: "#8b5cf6" },
  { id: "derm", label_fa: "پوست", label_en: "Derm", icon: "🖐️", grad: "from-orange-500 to-amber-600", color: "#f97316" },
  { id: "ophth", label_fa: "چشم", label_en: "Eye", icon: "👁️", grad: "from-cyan-500 to-blue-600", color: "#06b6d4" },
  { id: "stats", label_fa: "آمار", label_en: "Stats", icon: "📊", grad: "from-green-500 to-teal-600", color: "#16a34a" },
  { id: "ethics", label_fa: "اخلاق", label_en: "Ethics", icon: "⚖️", grad: "from-slate-600 to-slate-700", color: "#334155" },
  { id: "immuno", label_fa: "ایمنی", label_en: "Immune", icon: "🛡️", grad: "from-green-500 to-emerald-600", color: "#22c55e" },
  { id: "nutrition", label_fa: "تغذیه", label_en: "Nutr", icon: "🥗", grad: "from-lime-500 to-green-600", color: "#84cc16" },
  { id: "genetics", label_fa: "ژنتیک", label_en: "Gen", icon: "🧬", grad: "from-pink-500 to-rose-500", color: "#db2777" },
  { id: "anatomy", label_fa: "آناتومی", label_en: "Anatomy", icon: "🧍", grad: "from-orange-500 to-red-500", color: "#ea580c" },
  { id: "physio", label_fa: "فیزیولوژی", label_en: "Physio", icon: "⚡", grad: "from-cyan-500 to-blue-500", color: "#06b6d4" },
  { id: "biochem", label_fa: "بیوشیمی", label_en: "Biochem", icon: "🧪", grad: "from-violet-500 to-purple-600", color: "#8b5cf6" },
  { id: "histology", label_fa: "بافت‌شناسی", label_en: "Histology", icon: "🔬", grad: "from-pink-500 to-rose-500", color: "#ec4899" },
  { id: "embryo", label_fa: "جنین‌شناسی", label_en: "Embryo", icon: "🌱", grad: "from-green-500 to-emerald-600", color: "#22c55e" },
  { id: "micro", label_fa: "میکروب", label_en: "Micro", icon: "👾", grad: "from-teal-500 to-cyan-600", color: "#14b8a6" },
  { id: "biophys", label_fa: "بیوفیزیک", label_en: "Biophys", icon: "🔭", grad: "from-indigo-500 to-violet-600", color: "#6366f1" },
  { id: "physics", label_fa: "فیزیک", label_en: "Phys", icon: "⚛️", grad: "from-indigo-500 to-violet-600", color: "#6366f1" },
  { id: "other", label_fa: "سایر", label_en: "Other", icon: "✨", grad: "from-slate-500 to-gray-600", color: "#64748b" },
];
const TYPES = [
  { id: "mind", label_fa: "مایندمپ", label_en: "Mind", icon: "🧠" },
  { id: "approach", label_fa: "اپروچ", label_en: "Approach", icon: "🧭" },
];
const LEVELS = [
  { id: "core", label_fa: "پایه", label_en: "Core", color: "#0ea5e9" },
  { id: "high_yield", label_fa: "پربازده", label_en: "High-Yield", color: "#f59e0b" },
  { id: "emergency", label_fa: "اورژانس", label_en: "Emergency", color: "#ef4444" },
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

export default function Mindmap({ onBack }) {
  const { t, lang } = useApp();
  const [mode, setMode] = useState("bank");
  const [topics, setTopics] = useState(null);
  const [active, setActive] = useState(null);
  const [map, setMap] = useState(null);

  // bank advanced
  const [bank, setBank] = useState(null);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [filterSys, setFilterSys] = useState([]);
  const [filterType, setFilterType] = useState([]);
  const [filterLevel, setFilterLevel] = useState([]);
  const [filterBranch, setFilterBranch] = useState([]);
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nodeQ, setNodeQ] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    try {
      const slug = sessionStorage.getItem("openMindmap");
      if (slug && mode === "bank") {
        sessionStorage.removeItem("openMindmap");
        openBank(slug);
      }
    } catch {}
  }, [mode]);

  const [toast, setToast] = useState("");
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 2500); return () => clearTimeout(id); } }, [toast]);

  useEffect(() => {
    if (mode !== "classic") return;
    api.get(`/learn/mindmap/topics?lang=${lang}`).then(d => setTopics(d.topics || [])).catch(() => setTopics([]));
  }, [lang, mode]);

  useEffect(() => { const id = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(id); }, [qInput]);
  useEffect(() => setPage(1), [q, filterSys, filterType, filterLevel, filterBranch, sort, lang]);

  useEffect(() => {
    if (mode !== "bank") return;
    setBank(null);
    const qs = new URLSearchParams({ lang, page: String(page), pageSize: "20", sort });
    if (q) qs.set("q", q);
    if (filterSys.length) qs.set("system", filterSys.join(","));
    if (filterType.length) qs.set("type", filterType.join(","));
    if (filterLevel.length) qs.set("level", filterLevel.join(","));
    if (filterBranch.length) qs.set("branch", filterBranch.join(","));
    api.get(`/learn/mindmap-bank?${qs.toString()}`).then(setBank).catch(() => setBank({ items: [], total: 0 }));
  }, [lang, mode, q, filterSys, filterType, filterLevel, filterBranch, sort, page]);

  const toggle = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const clearFilters = () => { setQ(""); setQInput(""); setFilterSys([]); setFilterType([]); setFilterLevel([]); setFilterBranch([]); setSort("default"); setPage(1); };

  const openClassic = (slug) => {
    setActive(slug); setMap(null);
    api.get(`/learn/mindmap/${slug}?lang=${lang}`).then(setMap).catch(() => setMap({ empty: true, branches: [] }));
  };
  const openBank = (slug) => {
    setDetail(null); setDetailLoading(true); setNodeQ(null);
    api.get(`/learn/mindmap-bank/${slug}?lang=${lang}`).then(d => { setDetail(d); setDetailLoading(false); }).catch(() => setDetailLoading(false));
  };
  const openQuestionsFor = (concept, mindmapSlug) => {
    const qs = new URLSearchParams({ lang });
    if (concept) qs.set("concept", concept);
    if (mindmapSlug) qs.set("mindmap", mindmapSlug);
    api.get(`/learn/questions/by-concept?${qs.toString()}`).then(d => {
      setNodeQ({ concept: concept || mindmapSlug, items: d.items || [] });
      if (!d.items?.length) setToast(lang === "fa" ? "سؤالی برای این گره یافت نشد — ادمین می‌تواند لینک کند" : "No questions for this node");
    }).catch(() => setToast("خطا"));
  };

  const GraphView = ({ data }) => {
    if (data.locked) {
      return (
        <div className="relative overflow-hidden rounded-[20px] border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-8 text-center shadow-lg">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200/50 to-orange-200/50 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-yellow-200/50 to-amber-200/50 blur-2xl" />
          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-3xl shadow-lg shadow-amber-500/25">🔒</div>
            <h3 className="mt-4 text-xl font-black text-amber-900">{lang === "fa" ? "این نقشه ویژهٔ پرمیوم است" : "Premium Only"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-amber-800/80">
              {lang === "fa" ? "با پرمیوم، ۳۴۹ مایندمپ و اپروچِ لینک‌دار به بانک را باز کنید — ۳ نقشه برای آشنایی رایگان است." : "Unlock 349 linked maps with Premium — 3 free to preview."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/25 transition hover:scale-105 hover:shadow-xl">
                {lang === "fa" ? "✨ ارتقا به پرمیوم" : "✨ Upgrade"}
              </button>
              <button onClick={() => setDetail(null)} className="rounded-full border border-amber-200 bg-white/80 px-6 py-3 text-sm font-bold text-amber-800 backdrop-blur transition hover:bg-white">
                {lang === "fa" ? "بازگشت" : "Back"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    const hasPos = nodes.some(n => n.x !== 0 || n.y !== 0);

    if (!hasPos || nodes.length > 10) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nodes.map(n => {
              const st = branchStyle(n.branch);
              return (
                <button
                  key={n.id}
                  onClick={() => openQuestionsFor(n.id, data.slug)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50"
                  style={{ borderTop: `4px solid ${st.fg}` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50/0 via-slate-50/0 to-slate-50 opacity-0 transition group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl text-sm" style={{ background: st.bg, color: st.fg }}>{st.icon}</span>
                      <span className="text-xs font-black tracking-wide" style={{ color: st.fg }}>{st.label}</span>
                      <span className="ms-auto text-xs opacity-60">↗</span>
                    </div>
                    <div className="mt-3 line-clamp-3 text-sm font-bold leading-relaxed text-slate-800">{lang === "fa" ? n.label_fa : n.label_en}</div>
                    <div className="mt-2 text-xs font-medium text-slate-500">{lang === "fa" ? "لمس کنید → سؤالات مرتبط" : "Tap → related Qs"}</div>
                  </div>
                  {hovered === n.id && <div className="absolute inset-0 rounded-2xl ring-2 ring-slate-900/5" />}
                </button>
              );
            })}
          </div>
          {edges.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">→</span>
                {lang === "fa" ? "مسیرهای ارتباطی" : "Connections"}
              </div>
              <div className="flex flex-wrap gap-2">
                {edges.map((e, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-sky-500" /> {e.from} <span className="text-slate-400">→</span> {e.to} {e.label && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{e.label}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // SVG graph — attractive
    const W = 760, H = 520, pad = 24;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scaleX = (maxX - minX) || 1, scaleY = (maxY - minY) || 1;
    const norm = n => ({ ...n, _x: pad + ((n.x - minX) / scaleX) * (W - pad * 2 - 160) + 80, _y: pad + ((n.y - minY) / scaleY) * (H - pad * 2 - 60) + 30 });
    const N = nodes.map(norm);
    const idPos = Object.fromEntries(N.map(n => [n.id, n]));
    const meta = sysMeta(data.system);

    return (
      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow" style={{ background: meta.color }}>{data.type === "approach" ? "🧭" : "🧠"}</span>
            <span className="text-sm font-black text-slate-800">{data.title}</span>
          </div>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">{lang === "fa" ? "روی گره بزنید → سؤالات" : "Tap node → Questions"}</span>
        </div>
        <div className="relative h-[520px] w-full overflow-auto bg-[radial-gradient(circle_at_1px_1px,_#e2e8f0_1px,_transparent_0)] bg-[length:20px_20px]">
          <svg width={W} height={H} className="absolute inset-0">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={8} markerHeight={8} orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
              <filter id="shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
              </filter>
            </defs>
            {edges.map((e, i) => {
              const a = idPos[e.from], b = idPos[e.to];
              if (!a || !b) return null;
              return (
                <g key={i}>
                  <line x1={a._x} y1={a._y} x2={b._x} y2={b._y} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" markerEnd="url(#arrow)" opacity={0.9} />
                  {e.label && (
                    <g>
                      <rect x={(a._x + b._x) / 2 - 22} y={(a._y + b._y) / 2 - 14} width={44} height={16} rx={8} fill="white" stroke="#e2e8f0" />
                      <text x={(a._x + b._x) / 2} y={(a._y + b._y) / 2 - 3} fontSize={10} fill="#475569" textAnchor="middle" fontWeight={700}>{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {N.map(n => {
            const st = branchStyle(n.branch);
            return (
              <button
                key={n.id}
                onClick={() => openQuestionsFor(n.id, data.slug)}
                className="group absolute flex w-[160px] -translate-x-[80px] -translate-y-[28px] flex-col items-center gap-1 rounded-2xl border-2 bg-white px-3 py-2.5 shadow-lg transition-all hover:z-10 hover:scale-105 hover:shadow-xl"
                style={{ left: n._x, top: n._y, borderColor: st.fg, filter: "url(#shadow)" }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: st.bg, color: st.fg }}>{st.icon}</span>
                <span className="text-center text-xs font-black leading-tight" style={{ color: st.fg }}>{st.label}</span>
                <span className="text-center text-xs font-bold leading-tight text-slate-800 line-clamp-3">{lang === "fa" ? n.label_fa : n.label_en}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="page mx-auto max-w-6xl">
      {/* Top switch */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setMode("bank")} className={`rounded-full px-5 py-2.5 text-sm font-black shadow-sm transition ${mode === "bank" ? "bg-slate-900 text-white shadow-slate-900/20" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"}`}>
          ⭐ {lang === "fa" ? "بانکِ مایندمپ — ۳۴۹" : "MindMap Bank — 349"}
        </button>
        <button onClick={() => setMode("classic")} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${mode === "classic" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}>
          🗺️ {lang === "fa" ? "نقشه‌های درسی" : "Lesson maps"}
        </button>
      </div>

      {mode === "bank" && (
        <>
          {detailLoading && (
            <div className="grid gap-4">
              <div className="h-32 animate-pulse rounded-[20px] bg-slate-200" />
              <div className="h-96 animate-pulse rounded-[20px] bg-slate-200" />
            </div>
          )}

          {detail && !detailLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => { setDetail(null); setNodeQ(null); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                  <Icon name={lang === "fa" ? "chevronRight" : "chevronLeft"} size={16} /> {lang === "fa" ? "بازگشت به بانک" : "Back"}
                </button>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: sysMeta(detail.system).color }}>{detail.type === "approach" ? "🧭" : "🧠"}</span>
                  <span className="text-sm font-black text-slate-800">{detail.system.toUpperCase()}</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 blur-2xl" />
                <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 blur-2xl" />
                <div className="relative">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white shadow-lg" style={{ background: sysMeta(detail.system).color, boxShadow: `0 8px 20px ${sysMeta(detail.system).color}40` }}>
                      {detail.type === "approach" ? "🧭" : "🧠"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-xl font-black leading-tight text-slate-900 md:text-2xl">{detail.title}</h1>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{detail.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: sysMeta(detail.system).color }}>{sysMeta(detail.system)[lang === "fa" ? "label_fa" : "label_en"]}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">{detail.type === "approach" ? (lang === "fa" ? "اپروچ" : "Approach") : "Mind"} • {detail.level}</span>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{detail.nodes?.length || 0} {lang === "fa" ? "گره" : "nodes"} • {detail.edges?.length || 0} {lang === "fa" ? "یال" : "edges"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <GraphView data={detail} />

              {detail.related?.length > 0 && (
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">🎯</span>
                    <h3 className="text-sm font-black text-slate-900">{lang === "fa" ? "سؤالاتِ پیشنهادی" : "Suggested Questions"}</h3>
                    <span className="ms-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{detail.related.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {detail.related.map(q => (
                      <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 transition hover:border-slate-300 hover:shadow-md">
                        <div className="flex-1 text-sm font-medium leading-relaxed text-slate-800 line-clamp-2">{q.stem || `Q#${q.id}`}</div>
                        <button onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "browse" }))} className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800">
                          {lang === "fa" ? "حل کن" : "Solve"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => openQuestionsFor(null, detail.slug)} className="mt-4 w-full rounded-full border border-slate-200 bg-slate-50 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">
                    {lang === "fa" ? "همهٔ سؤالات این نقشه →" : "All questions →"}
                  </button>
                </div>
              )}

              {nodeQ && (
                <div className="rounded-[20px] border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white">🔗</span>
                      {lang === "fa" ? `سؤالات: ${nodeQ.concept}` : `Questions: ${nodeQ.concept}`}
                    </h3>
                    <button onClick={() => setNodeQ(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow hover:bg-slate-50">✕</button>
                  </div>
                  {nodeQ.items.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-600">{lang === "fa" ? "موردی یافت نشد" : "No questions yet"}</div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {nodeQ.items.map(q => (
                        <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
                          <div className="flex-1 text-sm font-medium text-slate-800">{q.q ? q.q.slice(0, 110) : `Q#${q.id}`} {q.premium ? "👑" : ""}</div>
                          <button onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "browse" }))} className="rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700">
                            {lang === "fa" ? "حل" : "Solve"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!detail && !detailLoading && (
            <>
              {/* Attractive search + filters */}
              <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">🔎</span>
                      <input
                        value={qInput}
                        onChange={e => setQInput(e.target.value)}
                        placeholder={lang === "fa" ? "جستجو: STEMI، آسم، هیپرکالمی، اپروچ..." : "Search: STEMI, asthma, hyperkalemia..."}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-10 pe-10 text-sm font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                      />
                      {qInput && (
                        <button onClick={() => { setQInput(""); setQ(""); }} className="absolute inset-y-0 end-2 my-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800">✕</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={sort} onChange={e => setSort(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 focus:border-slate-300 focus:outline-none">
                        <option value="default">{lang === "fa" ? "✨ پیشنهادی" : "✨ Featured"}</option>
                        <option value="newest">{lang === "fa" ? "🆕 جدیدترین" : "🆕 Newest"}</option>
                        <option value="nodes">{lang === "fa" ? "🧩 بیشترین گره" : "🧩 Most nodes"}</option>
                        <option value="title">{lang === "fa" ? "🔤 الفبا" : "🔤 A–Z"}</option>
                      </select>
                      {(q || filterSys.length || filterType.length || filterLevel.length || filterBranch.length) && (
                        <button onClick={clearFilters} className="h-12 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-700 hover:bg-rose-100">✕ {lang === "fa" ? "پاک" : "Clear"}</button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-slate-700">{lang === "fa" ? "دستگاه:" : "System:"}</span>
                    {SYSTEMS.map(s => {
                      const active = filterSys.includes(s.id);
                      const cnt = bank?.facetCounts?.system?.[s.id] || 0;
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggle(filterSys, setFilterSys, s.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${active ? "border-transparent text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                          style={active ? { background: s.color, boxShadow: `0 4px 12px ${s.color}30` } : {}}
                        >
                          <span>{s.icon}</span> {lang === "fa" ? s.label_fa : s.label_en} {cnt ? <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/20" : "bg-slate-100"}`}>{cnt}</span> : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-slate-700">{lang === "fa" ? "نوع:" : "Type:"}</span>
                    <button onClick={() => toggle(filterType, setFilterType, "mind")} className={`rounded-full border px-4 py-1.5 text-xs font-black ${filterType.includes("mind") ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-700"}`}>🧠 Mind {bank?.facetCounts?.type?.mind ? `(${bank.facetCounts.type.mind})` : ""}</button>
                    <button onClick={() => toggle(filterType, setFilterType, "approach")} className={`rounded-full border px-4 py-1.5 text-xs font-black ${filterType.includes("approach") ? "border-amber-600 bg-amber-600 text-white shadow" : "border-slate-200 bg-white text-slate-700"}`}>🧭 Approach {bank?.facetCounts?.type?.approach ? `(${bank.facetCounts.type.approach})` : ""}</button>
                    <span className="mx-1 h-4 w-px bg-slate-200" />
                    {LEVELS.map(l => {
                      const active = filterLevel.includes(l.id);
                      return (
                        <button key={l.id} onClick={() => toggle(filterLevel, setFilterLevel, l.id)} className={`rounded-full border px-3 py-1.5 text-xs font-black ${active ? "text-white shadow" : "border-slate-200 bg-slate-50 text-slate-700"}`} style={active ? { background: l.color, borderColor: l.color } : {}}>
                          {l.label_fa} {bank?.facetCounts?.level?.[l.id] ? `(${bank.facetCounts.level[l.id]})` : ""}
                        </button>
                      );
                    })}
                  </div>

                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white group-open:rotate-90 transition">▸</span>
                      {lang === "fa" ? "فیلترِ شاخه (branch) — OR داخل، AND با بقیه" : "Branch filter — OR inside, AND across"}
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["definition","etiology","patho","clinical","workup","treatment","complication","ddx","start","question","action"].map(b => {
                        const st = branchStyle(b);
                        const active = filterBranch.includes(b);
                        return (
                          <button key={b} onClick={() => toggle(filterBranch, setFilterBranch, b)} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ background: active ? st.fg : "white", color: active ? "white" : st.fg, borderColor: st.fg, opacity: active ? 1 : 0.85 }}>
                            {st.icon} {b} {bank?.facetCounts?.branch?.[b] ? `(${bank.facetCounts.branch[b]})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </details>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                    <span className="font-bold text-slate-700">
                      {bank ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-white">{bank.total} {lang === "fa" ? "نقشه" : "maps"}</span>
                          {q && <span className="ms-2 rounded-full border border-slate-200 bg-white px-3 py-1">“{q}”</span>}
                          {bank.previews ? <span className="ms-2 rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-800">{bank.previews} {lang === "fa" ? "رایگان" : "free"}</span> : null}
                        </>
                      ) : (
                        <span className="animate-pulse rounded-full bg-slate-200 px-3 py-1 text-slate-200">...</span>
                      )}
                    </span>
                    <span className="hidden text-slate-500 sm:inline">{lang === "fa" ? "قانون: OR داخل یک فاست، AND بین فاست‌ها" : "OR inside, AND across"} • {lang === "fa" ? "همهٔ کلمه‌ها باید بیایند" : "All terms must match"}</span>
                  </div>
                </div>
              </div>

              {!bank ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-40 animate-pulse rounded-[20px] bg-slate-200" />)}
                </div>
              ) : bank.items.length === 0 ? (
                <div className="mt-6 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow">🔍</div>
                  <h3 className="mt-4 text-sm font-black text-slate-900">{lang === "fa" ? "چیزی یافت نشد" : "Nothing found"}</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{lang === "fa" ? "فیلترها را کم کنید یا واژهٔ دیگری جستجو کنید" : "Try fewer filters or another term"}</p>
                  <button onClick={clearFilters} className="mt-4 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white hover:bg-slate-800">{lang === "fa" ? "پاک کردنِ فیلترها" : "Clear filters"}</button>
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {bank.items.map(it => {
                      const meta = sysMeta(it.system);
                      const lvl = LEVELS.find(l => l.id === it.level);
                      return (
                        <button
                          key={it.slug}
                          onClick={() => openBank(it.slug)}
                          className={`group relative overflow-hidden rounded-[20px] border bg-white p-5 text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${it.locked ? "border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50" : "border-slate-200 hover:border-slate-300"}`}
                        >
                          {/* Top accent */}
                          <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />
                          {it.locked && (
                            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-xs font-black text-white shadow">
                              🔒 {lang === "fa" ? "پرمیوم" : "Premium"}
                            </span>
                          )}
                          {it.isPreview && !it.locked && (
                            <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow">✓ {lang === "fa" ? "رایگان" : "Free"}</span>
                          )}

                          <div className="flex gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-white shadow-lg" style={{ background: meta.color, boxShadow: `0 8px 20px ${meta.color}30` }}>
                              {it.type === "approach" ? "🧭" : meta.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-sm font-black leading-tight text-slate-900 group-hover:text-slate-950">{it.title}</h3>
                              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{it.summary?.slice(0, 110)}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full px-2.5 py-1 text-xs font-black text-white" style={{ background: meta.color }}>{lang === "fa" ? meta.label_fa : meta.label_en}</span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${it.type === "approach" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                                  {it.type === "approach" ? (lang === "fa" ? "اپروچ" : "Approach") : (lang === "fa" ? "مایندمپ" : "Mind")}
                                </span>
                                {lvl && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold" style={{ color: lvl.color, borderColor: lvl.color + "30", background: lvl.color + "10" }}>{lvl.label_fa}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-600">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">🧩</span>
                              {it.nodes?.length || 0} {lang === "fa" ? "گره" : "nodes"} • {it.edges?.length || 0} {lang === "fa" ? "یال" : "edges"}
                            </span>
                            <span className="inline-flex items-center gap-1 font-black text-sky-600 group-hover:text-sky-700">
                              {lang === "fa" ? "مشاهده" : "View"} <span className="transition group-hover:translate-x-0.5">→</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {bank.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40">
                        {lang === "fa" ? "← قبلی" : "← Prev"}
                      </button>
                      <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white">{page} / {bank.totalPages}</span>
                      <button disabled={page >= bank.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40">
                        {lang === "fa" ? "بعدی →" : "Next →"}
                      </button>
                    </div>
                  )}

                  {bank.items.some(x => x.locked) && (
                    <div className="relative mt-6 overflow-hidden rounded-[20px] border border-violet-200 bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 p-[1px] shadow-xl">
                      <div className="rounded-[19px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 p-6">
                        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                          <div className="text-white">
                            <h3 className="text-base font-black">✨ {lang === "fa" ? "۳ نقشه رایگان، ۳۱۸ تای دیگر با پرمیوم" : "3 free, 318 more with Premium"}</h3>
                            <p className="mt-1 text-sm text-violet-100">{lang === "fa" ? "هر گره به بانکِ سؤالات لینک است — دو کلیک تا تسلط" : "Every node links to Qbank — 2 clicks to mastery"}</p>
                          </div>
                          <button onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))} className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-black text-violet-700 shadow-lg hover:bg-violet-50">
                            {lang === "fa" ? "ارتقا به پرمیوم →" : "Upgrade →"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <button onClick={onBack} className="mt-6 w-full rounded-full border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
            {t("back")}
          </button>
        </>
      )}

      {mode === "classic" && (
        <>
          {!topics ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-slate-200" />
          ) : active && map ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><span className="text-xl">{map.topic?.emoji}</span> {map.topic?.title}</h2>
                <button onClick={() => { setActive(null); setMap(null); }} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Icon name={lang === "fa" ? "chevronRight" : "chevronLeft"} size={15} /> {t("mindmapAll")}
                </button>
              </div>
              {map.empty ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🗺️</div>
                  <h3 className="mt-4 font-black text-slate-900">{t("mindmapEmpty")}</h3>
                  <p className="mt-1 text-sm text-slate-600">{t("mindmapEmptyHint")}</p>
                </div>
              ) : (
                <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white" style={{ background: map.topic?.color || "#2f7fd1" }}>{map.topic?.emoji}</span>
                    <div>
                      <div className="text-base font-black text-slate-900">{map.topic?.title}</div>
                      <div className="text-xs text-slate-600">{map.branches.length} {t("mindmapLessons")}</div>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {map.branches.map((br, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                        <div className="text-sm font-black text-slate-900">{br.emoji ? <span>{br.emoji} </span> : null}{br.lesson}</div>
                        <ul className="mt-3 space-y-2">
                          {br.children.map((c, j) => (
                            <li key={j} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${c.kind === "golden" ? "bg-amber-50 font-bold text-amber-900 border border-amber-200" : "bg-white text-slate-700 border border-slate-200"}`}>
                              <span className="shrink-0">{c.kind === "golden" ? "⭐" : "•"}</span>
                              <span className="leading-relaxed">{c.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onBack} className="w-full rounded-full border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("back")}</button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-black text-slate-900">🗺️ {t("mindmaps")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("mindmapsHint")}</p>
              </div>
              {topics.filter(tp => tp.hasContent).length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🗺️</div>
                  <h3 className="mt-4 font-black text-slate-900">{t("mindmapEmpty")}</h3>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {topics.filter(tp => tp.hasContent).map(tp => (
                    <button key={tp.slug} onClick={() => openClassic(tp.slug)} className="group rounded-[20px] border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow" style={{ background: tp.color || "#2f7fd1" }}>{tp.emoji}</span>
                        <div>
                          <div className="text-sm font-black text-slate-900 group-hover:text-slate-950">{tp.title}</div>
                          <div className="text-xs text-slate-600">{tp.branches} {t("mindmapLessons")}</div>
                        </div>
                        <span className="ms-auto text-slate-400 group-hover:text-slate-600">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onBack} className="mt-6 w-full rounded-full border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("back")}</button>
            </>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
