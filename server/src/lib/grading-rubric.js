/* grading-rubric.js — Admin/teacher-controlled VP scoring.

   A rubric says, for each student category (extern / intern):
     • which scoring SECTIONS count
     • how much each of those sections is worth
     • how the numbers are combined:
         weightMode "items"    (DEFAULT) = pool the checklist-item weights of the
                               included sections. This is the original behaviour,
                               so an extern with the default scope still scores
                               7/10 on the multi-section fixture.
         weightMode "sections" = weighted average of each included section's own
                               percentage. Empty sections (no items) are dropped
                               so their weight is redistributed, not scored as 0.

   Storage:
     settings.vp_grading   — university-wide default (JSON)
     classes.grading_json  — per-class override (JSON, null = inherit)

   The snapshot of the rubric that actually scored an attempt is stored on
   eval.meta.rubric so later changes to the panel cannot rewrite history. */

import {
  SECTIONS, SECTION_KEYS, EXTERN_SCOPE, scoreForScope, computeSectionScores,
} from "./history-sections.js";

export const RUBRIC_VERSION = 1;

export function defaultRoleSpec(role) {
  if (role === "extern") {
    const sectionWeights = {};
    for (const k of EXTERN_SCOPE) sectionWeights[k] = 1;
    return { sections: [...EXTERN_SCOPE], sectionWeights, weightMode: "items" };
  }
  const sectionWeights = {};
  for (const k of SECTION_KEYS) sectionWeights[k] = 1;
  return { sections: [...SECTION_KEYS], sectionWeights, weightMode: "items" };
}

export function defaultRubric() {
  return {
    version: RUBRIC_VERSION,
    roles: {
      extern: defaultRoleSpec("extern"),
      intern: defaultRoleSpec("intern"),
    },
  };
}

export function normalizeRoleSpec(raw, role = "intern") {
  const base = defaultRoleSpec(role === "extern" ? "extern" : "intern");
  if (!raw || typeof raw !== "object") return base;
  const incoming = Array.isArray(raw.sections)
    ? raw.sections.filter((s) => SECTION_KEYS.includes(s))
    : [];
  const sections = [...new Set(incoming.length ? incoming : base.sections)];
  const weightMode = raw.weightMode === "sections" ? "sections" : "items";
  const srcW = raw.sectionWeights && typeof raw.sectionWeights === "object"
    ? raw.sectionWeights
    : (raw.weights && typeof raw.weights === "object" ? raw.weights : {});
  const sectionWeights = {};
  for (const k of sections) {
    const w = Number(srcW[k]);
    sectionWeights[k] = Number.isFinite(w) && w >= 0 ? w : 1;
  }
  return { sections, sectionWeights, weightMode };
}

export function normalizeRubric(raw) {
  const d = defaultRubric();
  if (!raw || typeof raw !== "object") return d;
  const src = raw.roles && typeof raw.roles === "object" ? raw.roles : raw;
  return {
    version: RUBRIC_VERSION,
    roles: {
      extern: normalizeRoleSpec(src.extern, "extern"),
      intern: normalizeRoleSpec(src.intern, "intern"),
    },
  };
}

export function parseClassRubric(classRow) {
  if (!classRow) return null;
  const raw = classRow.grading_json != null ? classRow.grading_json : classRow.gradingRubric;
  if (raw == null || raw === "") return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (!(parsed.roles || parsed.extern || parsed.intern)) return null;
  return normalizeRubric(parsed);
}

export function resolveRubric(classRow, globalRaw) {
  return parseClassRubric(classRow) || normalizeRubric(globalRaw);
}

/* Weighted % over a role's included sections. */
export function scoreRoleWithRubric(results, roleSpec, role = "intern") {
  const spec = normalizeRoleSpec(roleSpec, role);
  const included = spec.sections;
  if (spec.weightMode !== "sections") {
    return { ...scoreForScope(results, included), weightMode: "items" };
  }
  let weighted = 0, weightSum = 0, items = 0, earned = 0, total = 0;
  for (const key of included) {
    const part = scoreForScope(results, [key]);
    items += part.items;
    earned += part.earned;
    total += part.total;
    // Empty section → redistribute (do not treat as a zero).
    if (part.total <= 0) continue;
    const w = Number(spec.sectionWeights[key]) || 0;
    if (w <= 0) continue;
    weighted += (part.score || 0) * w;
    weightSum += w;
  }
  const score = weightSum
    ? Math.round(weighted / weightSum)
    : (total ? Math.round((earned / total) * 100) : null);
  return { score, earned, total, items, weightMode: "sections" };
}

export function applyRubric(results, rubric, lang = "fa") {
  results = Array.isArray(results) ? results : [];
  const r = normalizeRubric(rubric);
  const base = computeSectionScores(results, lang);
  const ext = scoreRoleWithRubric(results, r.roles.extern, "extern");
  const intern = scoreRoleWithRubric(results, r.roles.intern, "intern");
  return {
    ...base,
    // Keep the default-item-pool extern identical to computeSectionScores so
    // existing 7/10 / 80% tests stay green when nobody customises the panel.
    extern: ext.score != null ? ext.score : base.history,
    intern: intern.score != null ? intern.score : base.overall,
    externItems: ext.items,
    internItems: intern.items,
    rubric: {
      version: r.version,
      externSections: r.roles.extern.sections,
      internSections: r.roles.intern.sections,
      externWeightMode: r.roles.extern.weightMode,
      internWeightMode: r.roles.intern.weightMode,
    },
  };
}

export function sameSectionSet(a = [], b = []) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function csvScopeLabel(role, spec) {
  const s = normalizeRoleSpec(spec, role);
  if (role === "intern" && sameSectionSet(s.sections, SECTION_KEYS)) {
    return "intern_score(all_sections)";
  }
  if (role === "extern" && sameSectionSet(s.sections, EXTERN_SCOPE)) {
    return "extern_score(history+exam+problem_list+ddx)";
  }
  return `${role}_score(${s.sections.join("+")})`;
}

export { SECTIONS, SECTION_KEYS, EXTERN_SCOPE };
