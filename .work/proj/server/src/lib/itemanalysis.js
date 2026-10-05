/* ================================================================
   itemanalysis.js — classical psychometric item analysis + learning
   telemetry for the teacher analytics panels.

   Shared by class flashcard decks and university exams so both report
   the same numbers:

     • facility (difficulty) index P   = mean score fraction on the item
     • discrimination index D         = P(top group) − P(bottom group),
       groups = top/bottom 27 % (Kelley) for N ≥ 6, otherwise halves
     • hint usage per item (mean progressive-hint level reached)
     • hint effectiveness = success rate with vs without hints
     • mean response time per item
     • weekly trend (attempts + mean score)
     • per-student support flags (low score / hint dependence / slowness)

   Inputs are answer records already stored client-side in
   class_flashcard_attempts.answers_json / attempts.transcript_json;
   nothing here mutates the database.
   ================================================================ */

const HINT_MAX = 20;          // more hints than this on one answer = garbage
const MS_MIN = 0;
const MS_MAX = 60 * 60 * 1000; // one hour per question is an AFK outlier

/* Clamp one client-supplied answer's telemetry so a crafted payload cannot
   poison the class statistics. Returns safe integers. */
export function answerTelemetry(ans = {}) {
  let hints = Number(ans.hintsUsed ?? ans.hintLevel ?? 0);
  if (!Number.isFinite(hints)) hints = 0;
  hints = Math.max(0, Math.min(HINT_MAX, Math.round(hints)));
  let ms = Number(ans.responseMs ?? 0);
  if (!Number.isFinite(ms) || ms < MS_MIN || ms > MS_MAX) ms = 0;
  return { hints, ms: Math.round(ms) };
}

export function createItemAnalysis() {
  return {
    item: new Map(),            // itemKey -> aggregates
    itemStudent: new Map(),     // itemKey -> Map(studentId -> {sum,total})
    perStudent: new Map(),      // studentId -> {hints,n,ms,msN,scoreSum,scoreN}
    trend: new Map(),          // week -> {sum,n}
    answerCount: 0,
    hintTotal: 0,
    hintAnswers: 0,
    msTotal: 0,
    msCount: 0,
  };
}

function itemSlot(acc, key, label_fa, label_en, topic) {
  let it = acc.item.get(key);
  if (!it) {
    it = { key, label_fa: label_fa || key, label_en: label_en || label_fa || key, topic: topic || "",
      sum: 0, total: 0, n: 0, hints: 0, ms: 0, msN: 0,
      noHintCorrect: 0, noHintN: 0, hintCorrect: 0, hintN: 0 };
    acc.item.set(key, it);
  }
  return it;
}

function studentSlot(acc, studentId) {
  let s = acc.perStudent.get(studentId);
  if (!s) { s = { hints: 0, n: 0, ms: 0, msN: 0 }; acc.perStudent.set(studentId, s); }
  return s;
}

/* Record one graded flashcard answer.
   fraction: achieved / proposed points (0..1); solved: final correctness. */
export function addFlashAnswer(acc, o) {
  const { studentId, itemKey, topic, label_fa, label_en, fraction, solved, hints, ms, createdAt, score } = o;
  const frac = Math.max(0, Math.min(1, Number.isFinite(Number(fraction)) ? Number(fraction) : 0));
  const it = itemSlot(acc, itemKey, label_fa, label_en, topic);
  it.sum += frac; it.total += 1; it.n += 1;
  it.hints += hints;
  if (ms > 0) { it.ms += ms; it.msN += 1; }
  if (solved) { if (hints > 0) it.hintCorrect++; else it.noHintCorrect++; }
  if (hints > 0) it.hintN++; else it.noHintN++;
  // per-student fraction for the discrimination index
  let byStu = acc.itemStudent.get(itemKey);
  if (!byStu) { byStu = new Map(); acc.itemStudent.set(itemKey, byStu); }
  const cell = byStu.get(studentId) || { sum: 0, n: 0 };
  cell.sum += frac; cell.n += 1; byStu.set(studentId, cell);
  // per-student telemetry
  if (studentId != null) {
    const ps = studentSlot(acc, studentId);
    ps.hints += hints; ps.n += 1;
    if (ms > 0) { ps.ms += ms; ps.msN += 1; }
  }
  acc.answerCount++; acc.hintTotal += hints; if (hints > 0) acc.hintAnswers++;
  if (ms > 0) { acc.msTotal += ms; acc.msCount++; }
  if (score != null) noteTrend(acc, createdAt, score);
}

/* Virtual-patient / whole-sitting scores still drive the weekly trend. */
export function noteTrend(acc, createdAt, score) {
  const d = new Date(`${String(createdAt || "").slice(0, 10)}T12:00:00`);
  let w;
  if (isNaN(d)) w = String(createdAt || "").slice(0, 10) || "?";
  else {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    w = d.toISOString().slice(0, 10);
  }
  const b = acc.trend.get(w) || { sum: 0, n: 0 };
  b.sum += Number(score || 0); b.n += 1; acc.trend.set(w, b);
}

function round2(n) { return Math.round(n * 100) / 100; }

/* members: [{ id, avg (0..100), ... }] — students with their overall mean.
   Returns rows + summary pieces the route merges into its payload. */
export function finishItemAnalysis(acc, members = []) {
  const ranked = members
    .filter((m) => Number.isFinite(Number(m.avg)))
    .map((m) => ({ id: m.id, avg: Number(m.avg) }))
    .sort((a, b) => b.avg - a.avg);
  const N = ranked.length;
  const groupSize = N >= 6 ? Math.max(1, Math.round(N * 0.27)) : Math.ceil(N / 2);
  const upper = new Set(ranked.slice(0, groupSize).map((m) => m.id));
  const lower = new Set(ranked.slice(N - groupSize).map((m) => m.id));

  const groupFraction = (byStu, set) => {
    let sum = 0, n = 0;
    for (const sid of set) {
      const cell = byStu.get(sid);
      if (cell && cell.n) { sum += cell.sum / cell.n; n++; }
    }
    return n ? sum / n : null;
  };

  const items = [...acc.item.values()].map((it) => {
    const facility = it.total ? Math.round((it.sum / it.total) * 100) : 0;
    const byStu = acc.itemStudent.get(it.key) || new Map();
    const pu = groupFraction(byStu, upper);
    const pl = groupFraction(byStu, lower);
    const discrimination = pu != null && pl != null ? round2(pu - pl) : null;
    const noHintRate = it.noHintN ? Math.round((it.noHintCorrect / it.noHintN) * 100) : null;
    const hintRate = it.hintN ? Math.round((it.hintCorrect / it.hintN) * 100) : null;
    return {
      key: it.key, label_fa: it.label_fa, label_en: it.label_en, topic: it.topic,
      n: it.n, facility, avgPct: facility, discrimination, D: discrimination,
      avgHints: it.n ? round2(it.hints / it.n) : 0,
      avgSec: it.msN ? round2(it.ms / it.msN / 1000) : null,
      noHintSuccess: noHintRate, withHintSuccess: hintRate,
      // classical flags for the teacher
      hard: facility < 40,
      poorDiscrimination: discrimination != null && N >= 6 && discrimination < 0.2,
    };
  });

  const trend = [...acc.trend.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, v]) => ({ week, attempts: v.n, avg: v.n ? Math.round(v.sum / v.n) : 0 }));

  // per-student support context
  const studentCtx = new Map();
  const avgHintsAll = acc.answerCount ? acc.hintTotal / acc.answerCount : 0;
  const avgMsAll = acc.msCount ? acc.msTotal / acc.msCount : null;
  for (const m of members) {
    const ps = acc.perStudent.get(m.id);
    if (!ps || !ps.n) continue;
    const stuHints = ps.hints / ps.n;
    const stuMs = ps.msN ? ps.ms / ps.msN : null;
    const reasons = [];
    if (Number.isFinite(Number(m.avg)) && Number(m.avg) < 70) reasons.push("low_score");
    if (stuHints >= 2 && stuHints > avgHintsAll * 1.5) reasons.push("hint_dependent");
    if (stuMs != null && avgMsAll != null && stuMs > avgMsAll * 1.8) reasons.push("slow");
    if (reasons.length) {
      studentCtx.set(m.id, {
        avgHints: round2(stuHints),
        avgSec: stuMs != null ? round2(stuMs / 1000) : null,
        reasons,
      });
    }
  }

  return {
    items,
    trend,
    studentCtx,
    summary: {
      answers: acc.answerCount,
      avgHintsPerAnswer: acc.answerCount ? round2(acc.hintTotal / acc.answerCount) : 0,
      pctAnswersWithHints: acc.answerCount ? Math.round((acc.hintAnswers / acc.answerCount) * 100) : 0,
      avgSecPerAnswer: acc.msCount ? round2(acc.msTotal / acc.msCount / 1000) : null,
    },
  };
}

/* Flatten item rows for CSV export (UTF-8 BOM is added by the caller). */
export function itemAnalysisCsv(rows, fa = true) {
  const head = fa
    ? ["شناسه/متن سؤال", "موضوع", "تعداد پاسخ", "ضریب دشواری P٪", "ضریب تمییز D",
        "میانگین راهنما", "میانگین زمان (ثانیه)", "درست بدون راهنما٪", "درست با راهنما٪", "وضعیت"]
    : ["Item", "Topic", "Answers", "Facility P%", "Discrimination D",
        "Avg hints", "Avg seconds", "Correct no-hint %", "Correct with-hint %", "Flags"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const flags = [
      r.hard ? (fa ? "دشوار" : "hard") : "",
      r.poorDiscrimination ? (fa ? "تمییز ضعیف" : "poor discrimination") : "",
    ].filter(Boolean).join(" ");
    const cell = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    lines.push([
      cell(fa ? r.label_fa : (r.label_en || r.label_fa)),
      cell(r.topic), r.n, r.facility, r.discrimination ?? "",
      r.avgHints, r.avgSec ?? "", r.noHintSuccess ?? "", r.withHintSuccess ?? "", flags,
    ].join(","));
  }
  return lines.join("\n") + "\n";
}
