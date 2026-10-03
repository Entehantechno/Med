import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { XpIcon } from "../../components/StatIcons.jsx";
import { DrMed, Microbe, MascotSay } from "../../components/PathMascots.jsx";
import { loadMascots, currentMascots, drLine, microbeLine, guideImg, DEFAULT_MASCOTS } from "../../lib/mascotConfig.js";
import Confetti from "../../components/Confetti.jsx";
import { AdCard } from "./AdCard.jsx";
import { MotionAd } from "./MotionAd.jsx";
import { PremiumInline } from "./PremiumBanner.jsx";
import { safeLocal } from "../../lib/storage.js";
import JumpAhead from "./JumpAhead.jsx";

/* A coherent accent color per SECTION (topic parent group). Each section gets
   its own identity color that tints its label, progress bar and node trail. */
const SECTION_THEME = {
  internal: "#2569b0",   // internal medicine — clinical blue
  major:    "#e0568a",   // major subjects — rose
  minor:    "#6d5bd0",   // minor subjects — violet
  floating: "#22a06b",   // floating subjects — green
  basic:    "#e0912e",   // basic sciences — amber
  other:    "#647184",
};
const sectionColor = (parent) => SECTION_THEME[parent] || SECTION_THEME.other;

/* System → mindmap mapping (topic slug → mindmap system id) */
const TOPIC_TO_SYSTEM = {
  gi: "gastro", pulmo: "pulmo", nephro: "nephro", heme: "heme", endo: "endo", rheum: "rheum", cardio: "cardio",
  surgery: "surgery", peds: "peds", obgyn: "obgyn", path: "path", infect: "infect", neuro: "neuro", psych: "psych",
  derm: "derm", ortho: "ortho", pharm: "pharm", uro: "uro", ophth: "ophth", ent: "ent", radio: "radio", stats: "stats",
  ethics: "ethics", genetics: "genetics", immuno: "immuno", nutrition: "nutrition", physics: "physics", anatomy: "anatomy",
  physio: "physio", biochem: "biochem", histology: "histology", embryo: "embryo", micro: "micro", biophys: "biophys",
};
const MINDMAP_SYSTEMS = [
  { id: "cardio", fa: "قلب", en: "Cardio", icon: "❤️", color: "#e11d48", grad: "from-rose-500 to-pink-600" },
  { id: "pulmo", fa: "ریه", en: "Lung", icon: "🫁", color: "#0284c7", grad: "from-sky-500 to-blue-600" },
  { id: "gastro", fa: "گوارش", en: "GI", icon: "🍃", color: "#059669", grad: "from-emerald-500 to-teal-600" },
  { id: "nephro", fa: "کلیه", en: "Kidney", icon: "🫘", color: "#7c3aed", grad: "from-violet-500 to-purple-600" },
  { id: "endo", fa: "غدد", en: "Endo", icon: "🧬", color: "#d97706", grad: "from-amber-500 to-orange-600" },
  { id: "neuro", fa: "مغز", en: "Neuro", icon: "🧠", color: "#0891b2", grad: "from-cyan-500 to-teal-600" },
  { id: "heme", fa: "خون", en: "Heme", icon: "🩸", color: "#dc2626", grad: "from-red-600 to-rose-700" },
  { id: "rheum", fa: "روماتو", en: "Rheum", icon: "🦴", color: "#a855f7", grad: "from-fuchsia-500 to-purple-600" },
  { id: "infect", fa: "عفونی", en: "Infect", icon: "🦠", color: "#16a34a", grad: "from-green-500 to-emerald-600" },
  { id: "peds", fa: "کودکان", en: "Peds", icon: "👶", color: "#ec4899", grad: "from-pink-500 to-rose-600" },
  { id: "obgyn", fa: "زنان", en: "OB-GYN", icon: "🤰", color: "#e11d48", grad: "from-rose-500 to-red-600" },
  { id: "surgery", fa: "جراحی", en: "Surgery", icon: "🔪", color: "#dc2626", grad: "from-red-500 to-rose-600" },
  { id: "path", fa: "پاتولوژی", en: "Path", icon: "🧫", color: "#9333ea", grad: "from-purple-500 to-violet-600" },
  { id: "pharm", fa: "دارو", en: "Pharm", icon: "💊", color: "#0ea5e9", grad: "from-sky-500 to-blue-600" },
  { id: "radio", fa: "رادیولوژی", en: "Radio", icon: "📷", color: "#64748b", grad: "from-slate-500 to-gray-600" },
  { id: "ent", fa: "گوش‌حلق", en: "ENT", icon: "👃", color: "#14b8a6", grad: "from-teal-500 to-emerald-600" },
  { id: "uro", fa: "اورولوژی", en: "Uro", icon: "🚹", color: "#2563eb", grad: "from-blue-500 to-indigo-600" },
  { id: "ortho", fa: "ارتوپدی", en: "Ortho", icon: "🦿", color: "#f59e0b", grad: "from-amber-500 to-orange-600" },
  { id: "psych", fa: "روان", en: "Psych", icon: "🎭", color: "#8b5cf6", grad: "from-violet-500 to-purple-600" },
  { id: "derm", fa: "پوست", en: "Derm", icon: "🖐️", color: "#f97316", grad: "from-orange-500 to-amber-600" },
  { id: "ophth", fa: "چشم", en: "Eye", icon: "👁️", color: "#06b6d4", grad: "from-cyan-500 to-blue-600" },
  { id: "stats", fa: "آمار", en: "Stats", icon: "📊", color: "#16a34a", grad: "from-green-500 to-teal-600" },
  { id: "ethics", fa: "اخلاق", en: "Ethics", icon: "⚖️", color: "#334155", grad: "from-slate-600 to-slate-700" },
  { id: "immuno", fa: "ایمنی", en: "Immune", icon: "🛡️", color: "#22c55e", grad: "from-green-500 to-emerald-600" },
  { id: "nutrition", fa: "تغذیه", en: "Nutr", icon: "🥗", color: "#84cc16", grad: "from-lime-500 to-green-600" },
  { id: "genetics", fa: "ژنتیک", en: "Gen", icon: "🧬", color: "#db2777", grad: "from-pink-500 to-rose-500" },
  { id: "anatomy", fa: "آناتومی", en: "Anatomy", icon: "🧍", color: "#ea580c", grad: "from-orange-500 to-red-500" },
  { id: "physio", fa: "فیزیولوژی", en: "Physio", icon: "⚡", color: "#06b6d4", grad: "from-cyan-500 to-blue-500" },
  { id: "biochem", fa: "بیوشیمی", en: "Biochem", icon: "🧪", color: "#8b5cf6", grad: "from-violet-500 to-purple-600" },
  { id: "histology", fa: "بافت‌شناسی", en: "Histology", icon: "🔬", color: "#ec4899", grad: "from-pink-500 to-rose-500" },
  { id: "embryo", fa: "جنین‌شناسی", en: "Embryo", icon: "🌱", color: "#22c55e", grad: "from-green-500 to-emerald-600" },
  { id: "micro", fa: "میکروب", en: "Micro", icon: "👾", color: "#14b8a6", grad: "from-teal-500 to-cyan-600" },
  { id: "biophys", fa: "بیوفیزیک", en: "Biophys", icon: "🔭", color: "#6366f1", grad: "from-indigo-500 to-violet-600" },
  { id: "emergency", fa: "اورژانس", en: "Emerg", icon: "🚨", color: "#ef4444", grad: "from-red-500 to-orange-600" },
];
// Choose white or dark text for a given background hex for WCAG contrast.
function contrastText(hex) {
  try {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length !== 6 && h.length !== 3) return "#fff";
    const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
    const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
    const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    return lum > 0.62 ? "#1e293b" : "#fff";
  } catch { return "#fff"; }
}

/* Redesigned learning path — a Duolingo-style winding node path grouped into
   colored UNIT headers. Research-informed 2025 improvements:
     • a sticky "continue" bar that always surfaces the very next lesson,
     • an overall progress header (total %) with a motivating message,
     • per-section (parent group) progress, and a "jump to current" affordance,
     • clearer done/locked/boss/legendary states + aria-current for a11y.
   Pure client redesign — same /learn/path data as before, so nothing regresses. */

const PARENT_LABEL = {
  internal: { fa: "دروس داخلی", en: "Internal Medicine" },
  major: { fa: "دروس ماژور", en: "Major Subjects" },
  minor: { fa: "دروس مینور", en: "Minor Subjects" },
  floating: { fa: "دروس شناور", en: "Floating Subjects" },
  basic: { fa: "علوم پایه", en: "Basic Sciences" },
};

function Stars({ n }) {
  return <div className="stars">{[1, 2, 3, 4, 5].map((i) => <XpIcon key={i} size={13} muted={i > n} />)}</div>;
}

/* Pairs premium extra practice stages as satellite mini-nodes attached beside
   their corresponding parent core lesson, keeping the main path continuous,
   uncluttered, and beautiful. */
function prepareTopicNodes(rawNodes = []) {
  const coreNodes = [];
  let lastCore = null;
  for (const n of rawNodes) {
    if (n.premium && lastCore) {
      lastCore.satellites = lastCore.satellites || [];
      lastCore.satellites.push(n);
    } else {
      const core = { ...n, satellites: [] };
      coreNodes.push(core);
      if (!n.premium) lastCore = core;
    }
  }
  return coreNodes;
}

export default function LearnPath({ openLesson, openLegendary, focusSlug, onFocused, onProfile }) {
  const { t, lang, flag } = useApp();
  const fa = lang === "fa";
  const [mindBank, setMindBank] = useState(null);
  const goMindmapSystem = (sysId) => {
    try { sessionStorage.setItem("mindmapFilterSystem", sysId); } catch {}
    try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: "mindmap" })); } catch {}
  };
  const goMindmapTopic = (slug) => {
    const sys = TOPIC_TO_SYSTEM[slug] || slug;
    goMindmapSystem(sys);
  };
  const [topics, setTopics] = useState(null);
  const [ads, setAds] = useState([]);
  const [sideAds, setSideAds] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [celebrate, setCelebrate] = useState(false);   // fire confetti once per newly-completed unit
  const [mascots, setMascots] = useState(currentMascots());  // admin-editable character config
  const [highlightSlug, setHighlightSlug] = useState(null);  // briefly glow the deep-linked topic
  // Round 5: a unit can hold 40–60 stages now. Keep the map light by showing a
  // window around the learner's frontier (last few done + next few) and let the
  // learner expand the full unit on demand.
  const [expanded, setExpanded] = useState({});
  // Duolingo-style: the big "up next" card shrinks to a slim sticky bar once
  // the learner scrolls into the path, so the map — not the chrome — owns the screen.
  const [compact, setCompact] = useState(false);
  const [popNode, setPopNode] = useState(null);   // tapped locked node → small hint bubble
  const [popSat, setPopSat] = useState(null);     // tapped satellite node → small hint bubble
  const [jumpTopic, setJumpTopic] = useState(null); // Round 9: «پرش از واحد» quiz modal
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 140);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { if (!popNode) return; const h = setTimeout(() => setPopNode(null), 2600); return () => clearTimeout(h); }, [popNode]);
  useEffect(() => {
    if (!popSat) return;
    const onClickAway = (e) => {
      if (!e.target.closest(".satellite-mini-node") && !e.target.closest(".satellite-pop")) {
        setPopSat(null);
      }
    };
    window.addEventListener("pointerdown", onClickAway);
    const h = setTimeout(() => setPopSat(null), 6000);
    return () => {
      window.removeEventListener("pointerdown", onClickAway);
      clearTimeout(h);
    };
  }, [popSat]);
  const currentRef = useRef(null);
  const autoScrolledRef = useRef(false); // one-time smart resume scroll per path mount
  const topicRefs = useRef({});   // slug → DOM node, so we can scroll to a specific topic

  useEffect(() => { loadMascots().then(setMascots).catch(() => setMascots(DEFAULT_MASCOTS)); }, []);
  useEffect(() => {
    api.get(`/learn/mindmap-bank?lang=${lang}&pageSize=1`).then(setMindBank).catch(()=>{});
  }, [lang]);

  useEffect(() => {
    api.get(`/learn/profile?lang=${lang}`).then((d) => setIsPremium(!!(d.profile?.premium_effective ?? d.profile?.premium))).catch(() => {});
    api.get(`/learn/path?lang=${lang}`).then((d) => {
      setTopics(d.topics);
      // Celebrate when a unit is completed that we haven't celebrated before.
      // We remember celebrated unit ids in localStorage so the shower fires only
      // the FIRST time a unit turns 100% — never on every visit.
      try {
        const seen = new Set(JSON.parse(safeLocal.getItem("medlab_units_done") || "[]"));
        const nowDone = (d.topics || []).filter((tp) => tp.total > 0 && tp.done >= tp.total).map((tp) => tp.id);
        const fresh = nowDone.filter((id) => !seen.has(id));
        if (fresh.length && seen.size /* not the very first load with pre-seeded progress */ >= 0) {
          // only celebrate if there IS a previously-stored baseline (avoids a
          // confetti storm on a brand-new device seeing seeded completions).
          const hadBaseline = safeLocal.getItem("medlab_units_done") !== null;
          if (hadBaseline && fresh.length) setCelebrate(true);
          safeLocal.setItem("medlab_units_done", JSON.stringify(nowDone));
        }
      } catch { /* celebration is best-effort */ }
    }).catch(() => setTopics([]));
    api.get(`/learn/ads?slot=path&lang=${lang}`).then((d) => setAds(d.ads || [])).catch(() => {});
    api.get(`/learn/ads?slot=sidebar&lang=${lang}`).then((d) => setSideAds(d.ads || [])).catch(() => {});
  }, [lang, reloadKey]);

  // auto-clear the celebration flag after the shower finishes
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(false), 3600);
    return () => clearTimeout(id);
  }, [celebrate]);

  // Deep-link: when we arrive with a focus topic (from the placement "start
  // here" recommendation), scroll to it and glow it briefly, then consume it.
  useEffect(() => {
    if (!focusSlug || !topics) return;
    const el = topicRefs.current[focusSlug];
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      setHighlightSlug(focusSlug);
      const t1 = setTimeout(() => setHighlightSlug(null), 2600);
      onFocused?.();   // clear the parent's focus so it doesn't re-fire on re-render
      return () => clearTimeout(t1);
    }
    onFocused?.();
  }, [focusSlug, topics]);

  // Smart resume: when the learner opens the path, automatically scroll to the
  // first available not-done lesson (the lesson after their last completed one).
  // It runs only once per mount, so after the first guided scroll the learner is
  // free to scroll manually without the page fighting them.
  useEffect(() => {
    if (!topics || focusSlug || autoScrolledRef.current) return;
    const id = setTimeout(() => {
      const el = currentRef.current;
      if (!el) return;
      autoScrolledRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightSlug("__current__");
      setTimeout(() => setHighlightSlug(null), 2200);
    }, 450);
    return () => clearTimeout(id);
  }, [topics, focusSlug]);

  if (!topics) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  // find the single "current" node across the whole path (first not-done, not-locked core lesson)
  let currentId = null, currentNode = null, currentTopic = null;
  for (const tp of topics) {
    const n = (tp.nodes || []).find((x) => !x.done && !x.locked && !x.premium);
    if (n) { currentId = n.id; currentNode = n; currentTopic = tp; break; }
  }

  // overall progress across the whole path
  const totalNodes = topics.reduce((s, tp) => s + (tp.total || 0), 0);
  const doneNodes = topics.reduce((s, tp) => s + (tp.done || 0), 0);
  const totalPct = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const allDone = totalNodes > 0 && doneNodes >= totalNodes;

  // per-section (parent) progress + the list of sibling topics (for the
  // "related subjects" emoji row shown on each unit header)
  const sectionAgg = {};
  const sectionTopics = {};
  for (const tp of topics) {
    const k = tp.parent || "other";
    sectionAgg[k] = sectionAgg[k] || { done: 0, total: 0 };
    sectionAgg[k].done += tp.done || 0;
    sectionAgg[k].total += tp.total || 0;
    (sectionTopics[k] ||= []).push(tp);
  }

  const jumpToCurrent = () => {
    if (currentRef.current) currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const startCurrent = () => { if (currentId) openLesson(currentId); };

  // motivating message based on progress
  const motivate = allDone
    ? (fa ? "تمام مسیر را کامل کردی! 🏆" : "You finished the whole path! 🏆")
    : totalPct >= 66 ? (fa ? "به خط پایان نزدیکی — ادامه بده!" : "Almost there — keep going!")
    : totalPct >= 33 ? (fa ? "عالی پیش می‌روی!" : "Great progress!")
    : totalPct > 0 ? (fa ? "قدم‌های اول برداشته شد 💪" : "You're off to a strong start 💪")
    : (fa ? "سفر یادگیری‌ات همین‌جا شروع می‌شود" : "Your learning journey starts here");

  let lastParent = null;
  return (
    <div className="page path-page">
      {celebrate && <Confetti duration={3400} pieces={180} />}
      {jumpTopic && <JumpAhead topic={jumpTopic} onClose={() => setJumpTopic(null)} onDone={() => setReloadKey((k) => k + 1)} onProfile={onProfile} />}
      <div className="section-title"><h2><Icon name="book" size={22} /> {t("learnPath")}</h2></div>

      {/* ---- Overall progress + continue bar (always shows what's next) ---- */}
      <div className={`path-progress-card ${compact ? "ppc-compact" : ""}`}>
        {compact && currentNode && (
          <div className="ppc-mini">
            <span className="ppc-mini-title">{currentTopic?.emoji || "📘"} {currentNode.title}</span>
            <span className="ppc-mini-pct">{totalPct}%</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={startCurrent}><Icon name="play" size={13} /> {fa ? "ادامه" : "Continue"}</button>
          </div>
        )}
        <div className="ppc-top">
          <div className="ppc-msg">{motivate}</div>
          <div className="ppc-pct">{totalPct}%</div>
        </div>
        <div className="ppc-bar"><span style={{ width: `${totalPct}%` }} /></div>
        <div className="ppc-sub">{doneNodes} / {totalNodes} {fa ? "درس تکمیل‌شده" : "lessons done"}</div>
        {currentNode && (
          <div className="ppc-continue">
            <div className="ppc-continue-info">
              <div className="ppc-continue-label">{fa ? "قدم بعدی" : "Up next"}</div>
              <div className="ppc-continue-title">{currentTopic?.emoji || "📘"} {currentNode.title}</div>
              {currentNode.subtitle && <div className="ppc-continue-subtitle small muted">{currentNode.subtitle}</div>}
            </div>
            <div className="ppc-continue-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={jumpToCurrent}>{fa ? "نمایش روی مسیر" : "Show on path"}</button>
              <button type="button" className="btn btn-primary" onClick={startCurrent}><Icon name="play" size={15} /> {fa ? "ادامهٔ یادگیری" : "Continue"}</button>
            </div>
          </div>
        )}
      </div>
      {/* Sidebar-slot motion ad — visible inline on path (hidden for premium); this guarantees the admin's \"sidebar\" slot is never wasted */}
      {!isPremium && sideAds.length > 0 && (
        <div className="mb16 motion-sidebar-strip" aria-label={fa ? "تبلیغ کناری" : "Sidebar promotion"}>
          <MotionAd ad={sideAds[0]} variant="path" />
        </div>
      )}

      {/* ==== Mindmaps — categorized strip (competitive path): global system chips + per-topic related ==== */}
      <div className="mm-strip card" style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "linear-gradient(180deg,#ffffff 0%, #f8fbff 100%)", boxShadow: "0 6px 22px rgba(15,23,42,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg,#06b6d4,#6366f1)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, boxShadow: "0 8px 18px rgba(99,102,241,.25)" }}>🧠</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: ".98rem", lineHeight: 1.1 }}>{fa ? "مایندمپ‌ها — دسته‌بندی سیستمیک" : "MindMaps — Browse by System"}</div>
              <div className="small muted" style={{ fontSize: ".78rem", lineHeight: 1.6 }}>{fa ? "۳۴۹ نقشهٔ لینک‌دار به بانک سوالات — رفرنس نامحدود ✓ · مایندمپ ۵/روز برای رایگان" : "349 linked maps — ref unlimited ✓ · 5/day free mindmaps"} {mindBank?.total ? <span style={{ background: "#0f172a", color: "#fff", borderRadius: 999, padding: "1px 8px", fontWeight: 800, fontSize: ".72rem", marginInlineStart: 6 }}>{mindBank.total} {fa ? "نقشه" : "maps"}</span> : null} {mindBank?.daily && mindBank.daily.limit < 999 ? <span className={`small`} style={{ background: mindBank.daily.remaining <= 1 ? "#fee2e2" : mindBank.daily.remaining <= 3 ? "#fef3c7" : "#dcfce7", color: mindBank.daily.remaining <= 1 ? "#991b1b" : mindBank.daily.remaining <= 3 ? "#92400e" : "#065f46", borderRadius: 999, padding: "1px 8px", fontWeight: 800, marginInlineStart: 6 }}>{mindBank.daily.remaining}/{mindBank.daily.limit} {fa ? "امروز" : "left today"}</span> : null}</div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { try{ window.dispatchEvent(new CustomEvent("medlab-go",{detail:"mindmap"})); }catch{}}} style={{ borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff" }}>{fa ? "همهٔ نقشه‌ها →" : "View all →"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {MINDMAP_SYSTEMS.map(s => {
            const cnt = mindBank?.facetCounts?.system?.[s.id] || 0;
            const isHot = cnt > 8;
            return (
              <button key={s.id} type="button" onClick={() => goMindmapSystem(s.id)} title={`${fa ? s.fa : s.en}${cnt ? ` · ${cnt}` : ""}`}
                className="mm-chip"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: cnt ? "1px solid transparent" : "1px solid #e2e8f0", background: cnt ? s.color : "#fff", color: cnt ? "#fff" : "#334155", fontWeight: 800, fontSize: ".78rem", boxShadow: cnt ? `0 6px 16px ${s.color}33` : "0 1px 4px rgba(0,0,0,.04)", transform: isHot ? "scale(1.02)" : undefined, transition: "all .15s" }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span> {fa ? s.fa : s.en} {cnt ? <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "1px 6px", fontSize: ".70rem", fontWeight: 900 }}>{cnt}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="small muted" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", lineHeight: 1.7 }}>
          <span style={{ background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 999, padding: "2px 8px", fontWeight: 700, color: "#1d4ed8" }}>📚 {fa ? "رفرنس نامحدود" : "Ref unlimited"} ✓</span>
          <span style={{ opacity: .9 }}>{fa ? "هر نقشه به سؤالات لینک است — دو کلیک تا تسلط" : "Every map links to Qbank — 2 clicks to mastery"}</span>
          <span style={{ marginInlineStart: "auto", opacity: .75 }}>{fa ? "۳ نقشه برای آشنایی رایگان است" : "3 free previews, then Plus"}</span>
        </div>
      </div>

      {topics.map((topic, ti) => {
        const parentHead = topic.parent !== lastParent ? topic.parent : null;
        lastParent = topic.parent;
        const pct = topic.total ? Math.round((topic.done / topic.total) * 100) : 0;
        const complete = topic.total > 0 && topic.done >= topic.total;
        const hasCurrent = currentTopic && currentTopic.id === topic.id;
        const sec = parentHead ? sectionAgg[parentHead] : null;
        const secPct = sec && sec.total ? Math.round((sec.done / sec.total) * 100) : 0;
        const secColor = sectionColor(topic.parent);
        // Dr. Med mood + phase for this section (deterministic per section id).
        const secPhase = secPct >= 100 ? "done" : secPct > 0 ? "mid" : "start";
        const drMood = secPct >= 100 ? "celebrate" : secPct > 0 ? "cheer" : "wave";
        const coreNodes = prepareTopicNodes(topic.nodes);
        const frontierIdx = Math.max(0, coreNodes.findIndex((n) => !n.done));
        return (
          <div key={topic.id} className={`path-section-wrap ${highlightSlug === topic.slug || (highlightSlug === "__current__" && hasCurrent) ? "topic-focus-glow" : ""}`}
            ref={(el) => { if (topic.slug) topicRefs.current[topic.slug] = el; }}
            style={{ "--sec": secColor }}>
            {parentHead && (
              <div className="path-section-label">
                <span className="psl-name">{fa ? PARENT_LABEL[parentHead]?.fa : PARENT_LABEL[parentHead]?.en}</span>
                {sec && sec.total > 0 && (
                  <span className="path-section-prog" aria-hidden="true">
                    <span className="psp-bar"><span style={{ width: `${secPct}%` }} /></span>
                    <span className="psp-pct">{secPct}%</span>
                  </span>
                )}
              </div>
            )}

            {/* ---- Dr. Med greets each new section (Duolingo-style side character) ---- */}
            {parentHead && mascots.enabled && mascots.dr.enabled && (
              <div className="path-mascot path-mascot-dr">
                <DrMed size={92} mood={drMood} src={guideImg(mascots, parentHead)} speed={mascots.speed} />
                <MascotSay side="start">{drLine(mascots, lang, secPhase, parentHead)}</MascotSay>
              </div>
            )}

            {/* ---- Unit header (colored banner) — clean & Duolingo-like:
                 icon + title + a small progress count. No extra clutter. ---- */}
            <div className={`unit-header ${complete ? "unit-header-done" : ""}`} style={{ background: topic.color || "var(--grad-primary)", color: contrastText(topic.color || "#2569b0") }}>
              <div className="unit-header-ico">
                {topic.emoji ? <span className="node-emoji">{topic.emoji}</span> : <Icon name={topic.icon} size={22} />}
              </div>
              <div className="unit-header-body">
                <div className="unit-header-title">{topic.name}{complete && " ✓"}</div>
                {topic.canJump && flag("jump_ahead") && (
                  <button type="button" className="unit-jump-btn" onClick={() => setJumpTopic(topic)} title={fa ? "با یک آزمون کوتاه، از این واحد بپر" : "Skip this unit with a short quiz"}>
                    🚀 {fa ? "پرش از واحد" : "Jump ahead"}
                  </button>
                )}
              </div>
              <div className="unit-header-prog">
                <div className="uhp-count">{topic.done}/{topic.total}</div>
                <div className="uhp-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
            {/* per-topic related mindmaps — categorized strip */}
            {(() => {
              const sysId = TOPIC_TO_SYSTEM[topic.slug] || topic.slug;
              const meta = MINDMAP_SYSTEMS.find(s => s.id === sysId);
              if (!meta) return null;
              const cnt = mindBank?.facetCounts?.system?.[sysId] || 0;
              return (
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", margin:"10px 2px 6px", padding:"8px 10px", borderRadius:12, background:`linear-gradient(135deg, ${meta.color}08, #ffffff)`, border:`1px solid ${meta.color}18`, boxShadow:"0 2px 10px rgba(15,23,42,.04)" }}>
                  <span style={{ width:26, height:26, borderRadius:8, background: meta.color, color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:`0 4px 10px ${meta.color}30` }}>{meta.icon}</span>
                  <span className="small" style={{ fontWeight:800, color:"#0f172a" }}>{fa ? `نقشه‌های \u00AB${topic.name}\u00BB` : `Maps for ${topic.name}`}</span>
                  <span className="small muted" style={{ fontSize:".74rem" }}>• {cnt ? `${cnt} ${fa?"نقشه":"maps"}` : (fa?"نقشه‌های سیستمیک":"system maps")} </span>
                  {cnt > 0 && <span className="small" style={{ background: meta.color, color:"#fff", borderRadius:999, padding:"1px 7px", fontWeight:900, fontSize:".70rem" }}>{cnt}</span>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>goMindmapTopic(topic.slug)} style={{ marginInlineStart:"auto", borderRadius:999, border:`1px solid ${meta.color}30`, background:"#fff", color: meta.color, fontWeight:800, fontSize:".74rem" }}>{fa ? "مشاهده نقشه‌ها →" : "View maps →"}</button>
                </div>
              );
            })()}

            {/* ---- Winding node path (single prepareTopicNodes per unit for perf) ---- */}
            <div className="unit-path">
              {coreNodes.length > 12 && !expanded[topic.id] && Math.max(0, frontierIdx - 2) > 0 && (
                <button type="button" className="unit-window-more" onClick={() => setExpanded((e) => ({ ...e, [topic.id]: true }))}>
                  <Icon name="check" size={13} /> {fa ? `${Math.max(0, frontierIdx - 2)} مرحلهٔ قبلی تکمیل شده — نمایش همه` : `${Math.max(0, frontierIdx - 2)} earlier stages done — show all`}
                </button>
              )}
              {coreNodes.map((n, ni) => {
                if (!expanded[topic.id] && coreNodes.length > 12) {
                  if (ni < frontierIdx - 2 || ni > frontierIdx + 6) return null;
                }
                  const mastered = n.stars >= 5;
                  const isCurrent = n.id === currentId;
                  // gentle winding S-curve (Duolingo-style): a smooth 6-step
                  // left↔right sway so the eye follows the path down the column.
                  // Reduced from 74 to 52 for narrow phones (320 px) — CSS further scales to 0.45×.
                  const sway = [0, 32, 52, 32, 0, -32, -52, -32];
                  const offset = sway[ni % sway.length];
                  const goPremium = () => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }));
                  const openNode = () => {
                    if (n.locked) { setPopNode(n.id); return; }
                    if (mastered && !n.legendary && openLegendary && flag("legendary")) openLegendary(n.id);
                    else openLesson(n.id);
                  };
                  const openSatellite = (sat) => {
                    if (popSat === sat.id) { setPopSat(null); return; }
                    if (sat.premiumLocked) { setPopSat(sat.id); return; }
                    if (sat.locked) { setPopSat(sat.id); return; }
                    openLesson(sat.id);
                  };
                  return (
                    <div className={`unit-node-row ${n.done ? "row-done" : ""}`} key={n.id} style={{ "--offset": `${offset}px`, "--i": ni }} ref={isCurrent ? currentRef : null}>
                      <div className="unit-node-main-wrap">
                        <button type="button"
                          className={`unit-node node ${n.done ? "done" : ""} ${n.locked ? "locked" : ""} ${n.kind === "boss" ? "boss" : ""} ${n.legendary ? "legendary" : ""} ${isCurrent ? "current" : ""}`}
                          aria-current={isCurrent ? "step" : undefined}
                          aria-label={`${n.title}${n.locked ? (fa ? " (قفل)" : " (locked)") : n.legendary ? (fa ? " (افسانه‌ای)" : " (legendary)") : n.done ? `${fa ? " تکمیل‌شده" : " done"} ${n.stars}/5` : isCurrent ? (fa ? " (درس فعلی)" : " (current)") : ""}${mastered && !n.legendary ? (fa ? " — برای چالش افسانه‌ای بزن" : " — tap for legendary") : ""}`}
                          onClick={openNode}
                          title={n.title}
                        >
                          {isCurrent && <div className="node-start-flag">{fa ? "شروع" : "START"}</div>}
                          {popNode === n.id && <div className="node-pop" role="status">{fa ? "اول درس قبلی را تمام کن" : "Finish the previous lesson first"}</div>}
                          <span className={`node-ring ${isCurrent ? "on" : ""}`} aria-hidden="true" />
                          <span className="unit-bubble bubble" style={!n.done && !n.locked && n.kind !== "boss" && !n.legendary ? { background: topic.color } : undefined}>
                            <span className="bubble-gloss" aria-hidden="true" />
                            {n.locked ? <Icon name="lock" size={26} />
                              : n.legendary ? <span className="node-emoji">👑</span>
                              : n.done ? <Icon name="check" size={30} />
                              : n.kind === "boss" ? <Icon name="trophy" size={26} />
                              : (n.emoji || topic.emoji)
                                ? <span className="node-emoji">{n.emoji || topic.emoji}</span>
                                : <Icon name="play" size={24} />}
                          </span>
                          {/* tiny star pips under DONE nodes — subtle, not a full label */}
                          {n.done && !n.legendary && <Stars n={n.stars} />}
                        </button>

                        {/* Compact satellite mini-node for extra practice */}
                        {n.satellites && n.satellites.length > 0 && (
                          <div className={`node-satellites-slot ${offset > 20 ? "side-start" : "side-end"}`}>
                            <span className="satellite-bridge" aria-hidden="true" />
                            {n.satellites.map((sat) => {
                              const satMastered = sat.stars >= 5;
                              return (
                                <div key={sat.id} style={{ position: "relative" }}>
                                  <button
                                    type="button"
                                    className={`satellite-mini-node ${sat.done ? "done" : ""} ${sat.locked && !sat.premiumLocked ? "locked" : ""} ${sat.premiumLocked ? "premium-locked" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); openSatellite(sat); }}
                                    title={sat.title}
                                    aria-label={sat.title}
                                  >
                                    {sat.done ? (satMastered ? "👑" : "✓") : "👑"}
                                  </button>
                                  {popSat === sat.id && (
                                    <div className="satellite-pop" role="status">
                                      {sat.premiumLocked ? (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>👑 {sat.title || (fa ? "تمرین تکمیلی" : "Extra Practice")}</div>
                                          <div className="small muted mt2" style={{ fontSize: ".72rem" }}>
                                            {fa ? `${sat.cards || 20} سؤال مفهومی تکمیلی` : `${sat.cards || 20} bonus practice questions`}
                                          </div>
                                          <button type="button" className="btn btn-primary btn-xs mt6" onClick={goPremium} style={{ width: "100%", padding: "4px 8px", fontSize: ".72rem" }}>
                                            {fa ? "👑 ارتقا به پلاس" : "👑 Upgrade to Plus"}
                                          </button>
                                        </div>
                                      ) : sat.locked ? (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>🔒 {sat.title || (fa ? "آزمون ماهواره‌ای" : "Satellite Test")}</div>
                                          <div className="small muted mt2">{fa ? "اول درس اصلی را کامل کن" : "Finish main lesson first"}</div>
                                        </div>
                                      ) : (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>👑 {sat.title}</div>
                                          <div className="small muted mt2">{sat.cards} {fa ? "سؤال تکمیلی" : "practice questions"}</div>
                                          <div className="small mt4" style={{ color: "var(--accent,#22a06b)", fontWeight: 700 }}>
                                            {sat.done ? (fa ? "تکرار تمرین" : "Practice again") : (fa ? "شروع آزمون" : "Start")}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Explicit stage label: the learner must know what this
                          stage quizzes before opening it (title + concepts). */}
                      <div className="unit-node-label" aria-hidden={n.locked}>
                        <div className="unl-title">{n.title}</div>
                        {n.subtitle && <div className="unl-subtitle">{n.subtitle}</div>}
                      </div>

                      {/* ---- Microbe rival guards an UN-DONE boss / checkpoint node. ---- */}
                      {n.kind === "boss" && !n.done && mascots.enabled && mascots.microbe.enabled && (
                        <div className="path-mascot path-mascot-boss">
                          <Microbe size={60} mood="smirk" src={mascots.microbe.img} speed={mascots.speed} />
                          {!n.locked && <MascotSay side="start">{microbeLine(mascots, lang, n.id)}</MascotSay>}
                        </div>
                      )}
                    </div>
                  );
                })}
              {coreNodes.length > 12 && !expanded[topic.id] && (coreNodes.length - 1 - (frontierIdx + 6)) > 0 && (
                <button type="button" className="unit-window-more" onClick={() => setExpanded((e) => ({ ...e, [topic.id]: true }))}>
                  <Icon name="lock" size={13} /> {fa ? `${coreNodes.length - 1 - (frontierIdx + 6)} مرحلهٔ دیگر — نمایش همه` : `${coreNodes.length - 1 - (frontierIdx + 6)} more stages — show all`}
                </button>
              )}
              {complete && (
                <div className="unit-complete-chip" aria-label={fa ? "این واحد کامل شد" : "Unit complete"}>
                  <Icon name="check" size={13} /> {fa ? "کامل شد" : "Complete"}
                </div>
              )}
            </div>

            {/* interleave a motion-graphic ad between subject groups — admin ad in motion shell, house premium promo when empty (hidden for premium) */}
            {ti === 2 && !isPremium && (
              <div className="mb16">
                {ads[0] ? (
                  <MotionAd ad={ads[0]} variant="path" />
                ) : (
                  <PremiumInline />
                )}
              </div>
            )}
          </div>
        );
      })}

      {allDone && (
        <div className="path-finish-card">
          🏆 <div>{fa ? "تبریک! کل مسیر یادگیری را کامل کردی." : "Congratulations! You completed the entire path."}</div>
        </div>
      )}
    </div>
  );
}
