/* programs.js — Multi-program support (Duolingo-style "courses").
   A learner picks an active PROGRAM; every learner view (path, home, exam-sim,
   mind-maps, study plan, crowd, community) is scoped to that program's topics.

   Built-in programs:
     preint = پره‌انترنی و دستیاری (pre-internship & residency)
     basic  = علوم پایه (basic sciences)
   Admins can enable/disable programs and reorder them via the settings key
   `programs` (falls back to the built-in list). */
import { db } from "../db.js";

export const DEFAULT_PROGRAMS = [
  { slug: "preint", fa: "پره‌انترنی و دستیاری", en: "Pre-internship & Residency", emoji: "🩺", active: true, ord: 0 },
  { slug: "basic",  fa: "علوم پایه",            en: "Basic Sciences",            emoji: "🔬", active: true, ord: 1 },
];

function getSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  try { return row ? JSON.parse(row.value) : fallback; } catch { return fallback; }
}

// full program list (admin-configured, merged over defaults so new built-ins appear)
export function listPrograms() {
  const saved = getSetting("programs", null);
  if (!Array.isArray(saved) || !saved.length) return DEFAULT_PROGRAMS;
  // ensure every default slug exists (so a newly-added built-in never disappears)
  const bySlug = Object.fromEntries(saved.map((p) => [p.slug, p]));
  for (const d of DEFAULT_PROGRAMS) if (!bySlug[d.slug]) saved.push(d);
  return saved.sort((a, b) => (a.ord || 0) - (b.ord || 0));
}

// only the programs a learner may choose (active ones that actually have topics)
export function activePrograms(lang = "fa") {
  const counts = Object.fromEntries(
    db.prepare("SELECT program, COUNT(*) c FROM topics WHERE active=1 GROUP BY program").all().map((r) => [r.program, r.c])
  );
  return listPrograms()
    .filter((p) => p.active !== false)
    .map((p) => ({
      slug: p.slug, emoji: p.emoji || "📚",
      label: lang === "fa" ? p.fa : p.en,
      topics: counts[p.slug] || 0,
    }));
}

export function programLabel(slug, lang = "fa") {
  const p = listPrograms().find((x) => x.slug === slug);
  return p ? (lang === "fa" ? p.fa : p.en) : slug;
}

// a learner's active program, guaranteed valid (falls back to the first active one)
export function activeProgramFor(userId) {
  const row = db.prepare("SELECT active_program FROM learner_profiles WHERE user_id=?").get(userId);
  const current = row?.active_program || "preint";
  const valid = new Set(activePrograms().map((p) => p.slug));
  if (valid.has(current)) return current;
  const first = activePrograms()[0];
  return first ? first.slug : "preint";
}

export function setActiveProgram(userId, slug) {
  const valid = new Set(activePrograms().map((p) => p.slug));
  if (!valid.has(slug)) return { error: "invalid program" };
  db.prepare("UPDATE learner_profiles SET active_program=? WHERE user_id=?").run(slug, userId);
  return { ok: true, program: slug };
}

export function saveProgramsSetting(programs) {
  db.prepare("INSERT INTO settings (key,value) VALUES ('programs', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(programs));
  return { ok: true };
}
