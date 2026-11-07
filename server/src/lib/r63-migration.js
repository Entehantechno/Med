/* Round 63 one-time migration.

   Upgrades ONLY rows that still hold the exact shipped R62 defaults:
   - checklists: the default ACS / abdominal / history-taking checklists and the
     emergency rubrics 101/102, matched by sha256 of the stored items_json;
   - prompts: the patient rules, lab-normal and evaluator texts, matched by the
     sha256 of the stored value (the `prompts` table and the university
     `prompts_vpatient` setting).

   Anything an admin or teacher edited has a different hash and is left alone.
   Idempotent: the settings flag is written in the same transaction. The hashes
   below were taken from the R62 seed (see docs/rounds/APP-ROUND63-REPORT.md). */
import { createHash } from "node:crypto";
import { DEFAULT_CHECKLIST_1, DEFAULT_CHECKLIST_2, DEFAULT_CHECKLIST_3 } from "../data/default-checklists.js";
import { EMERGENCY_RUBRICS } from "../data/emergency-rubrics.js";
import { PROMPT_DEFAULTS_R63 } from "../data/prompt-defaults.js";

export const R63_FLAG = "migr.r63_facets_and_normal_defaults";
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");

// sha256(R62 items_json) -> canonical R63 items
const CHECKLIST_UPGRADES = new Map([
  ["61040629c0ccbf06a4d985f0a6a8934f736fe39d12342fd05212540b60bff28d", DEFAULT_CHECKLIST_1],
  ["9f33fb34f1ddec864708c22c0cbd91b35cbcf8df4d959687a048ecc12d276558", DEFAULT_CHECKLIST_2],
  ["e687c40e01bdd0ddf70a9e5d4096fcd5bd86b0e68eb766366bbc77d2b2ded1da", DEFAULT_CHECKLIST_3],
  ["0341cc611f59fc98603538253f093bc478fba325fdd4281cc1e23f1be77744ae", EMERGENCY_RUBRICS[101].items],
  ["a14b70c114281e2b88df06e31b8483d10f1e12f3cbc9d647fa294c50c56949ac", EMERGENCY_RUBRICS[102].items],
].map(([hash, items]) => [hash, JSON.stringify(items)]));

// sha256(R62 prompt value) -> key
const PRIOR_PROMPT_HASH = {
  patient_rules_fa: "4cecb63f39dd9a5e02dc9f41bc29526754c507c2a3c351c342a440270860b9f6",
  patient_rules_en: "f8552abb7ff7ddc2214a8cc7085e5aad61348912333b73d8599310a60133682c",
  lab_normal_fa: "a0d432a07d9dbc061cbd1b2c16ab8257e829cf3711925d6d9d30fbd45c40f131",
  lab_normal_en: "89161fce44c92cc57b2288c812a0b528d7f6e4ff0ba8e8c78971d6e8117e5745",
  evaluator_fa: "4cede444c826c643ed5c0eed367e1f7139661aba2f38dad870a5ca1c6091df55",
  evaluator_en: "47db0e54faa1a3586a5a340a7d8b7d3016f35c6fc8d358aa3e634cc4145fa0ba",
};

export function migrateR63(db) {
  if (db.prepare("SELECT 1 FROM settings WHERE key=?").get(R63_FLAG)) return { skipped: true };
  const stats = { checklists: 0, prompts: 0, universityPrompts: 0 };
  db.transaction(() => {
    const updateChecklist = db.prepare("UPDATE checklists SET items_json=? WHERE id=?");
    for (const row of db.prepare("SELECT id, items_json FROM checklists").all()) {
      const next = CHECKLIST_UPGRADES.get(sha(row.items_json || ""));
      if (!next) continue;
      updateChecklist.run(next, row.id);
      stats.checklists++;
    }
    const readPrompt = db.prepare("SELECT value FROM prompts WHERE key=?");
    const writePrompt = db.prepare("UPDATE prompts SET value=? WHERE key=?");
    for (const key of Object.keys(PROMPT_DEFAULTS_R63)) {
      const row = readPrompt.get(key);
      if (row && sha(row.value) === PRIOR_PROMPT_HASH[key]) {
        writePrompt.run(PROMPT_DEFAULTS_R63[key], key);
        stats.prompts++;
      }
    }
    const vp = db.prepare("SELECT value FROM settings WHERE key='prompts_vpatient'").get();
    if (vp) {
      let obj = null;
      try { obj = JSON.parse(vp.value); } catch { obj = null; }
      if (obj && typeof obj === "object") {
        let changed = false;
        for (const key of Object.keys(PROMPT_DEFAULTS_R63)) {
          if (typeof obj[key] === "string" && sha(obj[key]) === PRIOR_PROMPT_HASH[key]) {
            obj[key] = PROMPT_DEFAULTS_R63[key];
            changed = true;
            stats.universityPrompts++;
          }
        }
        if (changed) db.prepare("UPDATE settings SET value=? WHERE key='prompts_vpatient'").run(JSON.stringify(obj));
      }
    }
    db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,'1')").run(R63_FLAG);
  })();
  return stats;
}
