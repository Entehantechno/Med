/* Round 64 one-time migration (idempotent, two independent flags).

   Upgrades ONLY untouched R63 criteria. An item is replaced when its stored JSON is
   exactly the R63 default (same keys, order, text and keys). Anything an admin or
   teacher edited differs and is left alone.

   1. ECG (migr.r64_ecg_single_criterion): the R63 ECG criterion carried an urgency
      facet. R64 reverts it to a single criterion with no timing (user decision).
   2. Granular history/exam (migr.r64_granular_history_exam): criteria split into
      evidence groups so partial answers earn partial credit (R64_SPLITS).

   The R63 snapshots below were generated from `git show 00e9a50:server/src/data/default-checklists.js`. */
import { R64_ECG, R64_SPLITS } from "../data/default-checklists.js";

export const R64_FLAG = "migr.r64_ecg_single_criterion";
export const R64_GRANULAR_FLAG = "migr.r64_granular_history_exam";

export const R63_ECG = {
  "id": "i4",
  "section": "workup",
  "weight": 3,
  "fa": "درخواست نوار قلب (ECG)",
  "en": "Order ECG",
  "keys": [
    "ecg|نوار قلب|الکتروکاردیو|ekg",
    "فوری|فوراً|سریع|بلافاصله|اولویت|as soon|soon|stat|immediate|urgent"
  ]
};
export const R63_CL1_I3 = {
  "id": "i3",
  "section": "history",
  "weight": 2,
  "fa": "پرسش عوامل خطر قلبی (دیابت، فشار، چربی، سیگار)",
  "en": "Ask cardiac risk factors (DM, HTN, smoking, family)",
  "keys": [
    "دیابت|diabet",
    "فشار خون|hypertens",
    "سیگار|smok",
    "سابقه قلبی|cardiac history"
  ]
};
export const R63_CL1_I_ROS = {
  "id": "i_ros",
  "section": "history",
  "weight": 2,
  "fa": "مرور سیستم‌ها (ROS: تنگی‌نفس، تعریق سرد، تهوع، تپش قلب)",
  "en": "Review of systems (ROS: dyspnea, cold sweat, nausea, palpitation)",
  "keys": [
    "تنگی نفس|dyspnea|shortness of breath",
    "تعریق|عرق سرد|sweat",
    "تهوع|nausea",
    "تپش|palpitation"
  ]
};
export const R63_CL1_I_EXAM = {
  "id": "i_exam",
  "section": "exam",
  "weight": 2,
  "fa": "معاینه فیزیکی و علائم حیاتی (فشار خون، نبض، سمع قلب و ریه)",
  "en": "Physical exam & vitals (BP, pulse, auscultation)",
  "keys": [
    "معاینه|physical exam|examin",
    "علائم حیاتی|vitals|فشار خون|bp",
    "نبض|pulse",
    "سمع|auscultat"
  ]
};
export const R63_CL2_I4 = {
  "id": "i4",
  "section": "exam",
  "weight": 3,
  "fa": "معاینه فیزیکی شکم و بررسی تندرنس یا علامت مورفی",
  "en": "Abdominal physical exam & Murphy's sign / tenderness",
  "keys": [
    "معاینه شکم|abdominal exam|physical exam|examin",
    "مورفی|murphy|تندرنس|tenderness|لمس|palpat"
  ]
};
export const R63_CL3_C7 = {
  "id": "c7",
  "weight": 2,
  "fa": "شکایت اصلی را سیستماتیک بررسی کرد (محل، شدت، زمان شروع، عوامل تشدید/تسکین و ...).",
  "en": "Explored the complaint systematically (site, severity, onset, aggravating/relieving factors…).",
  "keys": [
    "محل|کجا|location|site|انتشار|radiat",
    "شدت|severity|چقدر|scale|how bad",
    "زمان|شروع|onset|از کی|چند وقت|duration|since",
    "تشدید|تسکین|بدتر|بهتر|aggravat|relie|worse|better|provok"
  ]
};

const sameItem = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ECG_RULES = [{ from: R63_ECG, to: [R64_ECG] }];
const SPLIT_RULES = [
  { from: R63_CL1_I3, to: R64_SPLITS.cl1_i3 },
  { from: R63_CL1_I_ROS, to: R64_SPLITS.cl1_i_ros },
  { from: R63_CL1_I_EXAM, to: R64_SPLITS.cl1_i_exam },
  { from: R63_CL2_I4, to: R64_SPLITS.cl2_i4 },
  { from: R63_CL3_C7, to: R64_SPLITS.cl3_c7 },
];

// Runs one rule set once. Writes its flag in the same transaction.
function runOnce(db, flag, rules) {
  if (db.prepare("SELECT 1 FROM settings WHERE key=?").get(flag)) return null;
  const stats = { checklists: 0, items: 0 };
  db.transaction(() => {
    const update = db.prepare("UPDATE checklists SET items_json=? WHERE id=?");
    for (const row of db.prepare("SELECT id, items_json FROM checklists").all()) {
      let parsed;
      try { parsed = JSON.parse(row.items_json || "null"); } catch { continue; }
      // Stored either as a bare array or wrapped as { items: [...] } (see db.js R62 upgrade).
      const wrapped = parsed && !Array.isArray(parsed) && Array.isArray(parsed.items);
      const list = wrapped ? parsed.items : parsed;
      if (!Array.isArray(list)) continue;
      let changed = false;
      const next = [];
      for (const item of list) {
        const rule = rules.find((r) => item && sameItem(item, r.from));
        if (!rule) { next.push(item); continue; }
        changed = true;
        stats.items++;
        for (const x of rule.to) next.push({ ...x, keys: [...x.keys] });
      }
      if (!changed) continue;
      update.run(JSON.stringify(wrapped ? { ...parsed, items: next } : next), row.id);
      stats.checklists++;
    }
    db.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)").run(flag, JSON.stringify({ at: new Date().toISOString() }));
  })();
  return stats;
}

/* Returns { ecg, granular } stats, or { skipped: true } when both already ran. */
export function migrateR64(db) {
  const ecg = runOnce(db, R64_FLAG, ECG_RULES);
  const granular = runOnce(db, R64_GRANULAR_FLAG, SPLIT_RULES);
  if (!ecg && !granular) return { skipped: true };
  return { ecg, granular };
}
