import { sealEncounter, readEncounter } from "../lib/vp-encounter.js";
/* University-scoped and Learning-domain PORTABLE export, validation, and transactional restore.
   Includes complete relationship graph, historical versions, sessions, research records,
   media packaging, and ID remapping with safe staging and rollback. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { namespaceForUniversity } from "../lib/academic-storage.js";
import { syncUniversityTenantDatabase, syncLearningDomainDatabase } from "../lib/domain-storage.js";
import { Router } from "express";
import multer from "multer";
import { db, durableTransaction } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { requirePerm } from "../lib/rbac.js";
import { audit } from "../lib/audit.js";
import {
  ACADEMIC_DIR,
  LEARNING_DIR,
  PORTABLE_STAGING_DIR,
  ensureDataDirs,
} from "../lib/paths.js";
import {
  createPortableZip,
  readPortableZip,
  safeArchivePath,
} from "../lib/portable-zip.js";
import {
  parseReferenceSnapshot,
  referenceSnapshotForPolicy,
} from "../lib/reference-governance.js";

const MAX_BUNDLE = 250 * 1024 * 1024;
const MAX_JSON = 64 * 1024 * 1024;
const digest = (b) => crypto.createHash("sha256").update(b).digest("hex");
const iso = () => new Date().toISOString();
const num = (v) =>
  Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stable(v[k]))
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function json(v) {
  return Buffer.from(`${stable(v)}\n`, "utf8");
}

function parseJson(buf, name) {
  if (buf.length > MAX_JSON) throw Error(`json_too_large:${name}`);
  try {
    const v = JSON.parse(buf.toString("utf8"));
    if (!v || typeof v !== "object") throw Error();
    return v;
  } catch {
    throw Error(`invalid_json:${name}`);
  }
}

function isTrack(row, track) {
  try {
    return JSON.parse(row.data_json || "{}").track === track;
  } catch {
    return false;
  }
}

function hasTable(table) {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
}

function rows(sql, ...args) {
  return db.prepare(sql).all(...args);
}

function tenantNamespace(uni) {
  return namespaceForUniversity(uni.id);
}

function namespaceDirs(namespace) {
  ensureDataDirs();
  const root = path.join(ACADEMIC_DIR, namespace);
  for (const d of [
    root,
    path.join(root, "exports"),
    path.join(root, "imports"),
    path.join(root, "media"),
    LEARNING_DIR,
    PORTABLE_STAGING_DIR,
  ]) {
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  }
  return {
    root,
    exports: path.join(root, "exports"),
    imports: path.join(root, "imports"),
    media: path.join(root, "media"),
  };
}

function safeFileName(v) {
  return (
    String(v || "bundle")
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .slice(0, 120) || "bundle"
  );
}

function onlyRow(row, keys) {
  const o = {};
  for (const k of keys) if (Object.hasOwn(row, k)) o[k] = row[k];
  return o;
}

function asArray(v, name) {
  if (!Array.isArray(v)) throw Error(`invalid_array:${name}`);
  return v;
}

function entityPath(ns, file) {
  return `academic/${ns}/${file}`;
}

function bundleFileMap(parsed) {
  const out = new Map();
  for (const e of parsed) {
    if (out.has(e.path)) throw Error("duplicate_bundle_entry");
    out.set(e.path, e.data);
  }
  return out;
}

function referenceExportIds(policies) {
  return [...new Set(policies.map((p) => num(p.reference_id)).filter(Boolean))];
}

function exportedIdentities(uniId) {
  return rows(
    `SELECT id,username,name_fa,name_en,student_no,role,status,created_at,university_id FROM users WHERE university_id=? AND role IN ('student','teacher') ORDER BY id`,
    uniId,
  ).map((u) => ({ ...u, source_user_id: u.id }));
}

/* Build complete academic graph payload */
function buildCompletePayload(uni, namespace, finalPreview = true) {
  const policies = rows(
    "SELECT * FROM course_reference_policies WHERE university_id=? ORDER BY id",
    uni.id,
  );
  const refIds = referenceExportIds(policies);
  const refs = refIds.length
    ? rows(
        `SELECT * FROM reference_catalog WHERE id IN (${refIds.map(() => "?").join(",")}) ORDER BY id`,
        ...refIds,
      )
    : [];

  const cases = rows(
    "SELECT * FROM cases WHERE university_id=? ORDER BY id",
    uni.id,
  ).filter((x) => !isTrack(x, "learn"));
  const caseIds = cases.map((x) => x.id);

  const caseVersions =
    caseIds.length && hasTable("case_versions")
      ? rows(
          `SELECT * FROM case_versions WHERE case_id IN (${caseIds.map(() => "?").join(",")}) ORDER BY id`,
          ...caseIds,
        )
      : [];

  const cards = rows(
    "SELECT * FROM flashcards WHERE university_id=? ORDER BY id",
    uni.id,
  ).filter((x) => !isTrack(x, "learn"));
  const cardIds = cards.map((x) => x.id);

  const cardVersions =
    cardIds.length && hasTable("flashcard_versions")
      ? rows(
          `SELECT * FROM flashcard_versions WHERE flashcard_id IN (${cardIds.map(() => "?").join(",")}) ORDER BY id`,
          ...cardIds,
        )
      : [];

  const cardRevisions =
    cardIds.length && hasTable("card_revisions")
      ? rows(
          `SELECT * FROM card_revisions WHERE card_id IN (${cardIds.map(() => "?").join(",")}) ORDER BY id`,
          ...cardIds,
        )
      : [];

  const checklistIds = [
    ...new Set(cases.map((x) => num(x.checklist_id)).filter(Boolean)),
  ];
  const checks = checklistIds.length
    ? rows(
        `SELECT * FROM checklists WHERE id IN (${checklistIds.map(() => "?").join(",")}) ORDER BY id`,
        ...checklistIds,
      )
    : [];

  const classes = rows(
    "SELECT * FROM classes WHERE university_id=? ORDER BY id",
    uni.id,
  );
  const classIds = classes.map((x) => x.id);

  const exams = rows(
    "SELECT * FROM exams WHERE university_id=? ORDER BY id",
    uni.id,
  );
  const examIds = exams.map((x) => x.id);

  const classCases = classIds.length
    ? rows(
        `SELECT * FROM class_cases WHERE class_id IN (${classIds.map(() => "?").join(",")})`,
        ...classIds,
      ).filter((x) => caseIds.includes(x.case_id))
    : [];

  const classCards =
    classIds.length && hasTable("class_flashcards")
      ? rows(
          `SELECT * FROM class_flashcards WHERE class_id IN (${classIds.map(() => "?").join(",")})`,
          ...classIds,
        ).filter((x) => cardIds.includes(x.flashcard_id))
      : [];

  const users = exportedIdentities(uni.id);
  const userIds = users.map((x) => x.id);

  const members = classIds.length
    ? rows(
        `SELECT * FROM class_members WHERE class_id IN (${classIds.map(() => "?").join(",")})`,
        ...classIds,
      ).filter((x) => userIds.includes(x.user_id))
    : [];

  const classCardAttempts =
    classIds.length && userIds.length && hasTable("class_flashcard_attempts")
      ? rows(
          `SELECT * FROM class_flashcard_attempts WHERE class_id IN (${classIds.map(() => "?").join(",")}) AND user_id IN (${userIds.map(() => "?").join(",")})`,
          ...classIds,
          ...userIds,
        )
      : [];

  const examParticipants =
    examIds.length && hasTable("exam_participants")
      ? rows(
          `SELECT * FROM exam_participants WHERE exam_id IN (${examIds.map(() => "?").join(",")})`,
          ...examIds,
        ).filter((x) => userIds.includes(x.user_id))
      : [];

  const examAssignments =
    userIds.length && caseIds.length && hasTable("exam_assignments")
      ? rows(
          `SELECT * FROM exam_assignments WHERE user_id IN (${userIds.map(() => "?").join(",")}) AND case_id IN (${caseIds.map(() => "?").join(",")})`,
          ...userIds,
          ...caseIds,
        )
      : [];

  const attempts =
    caseIds.length && userIds.length
      ? rows(
          `SELECT * FROM attempts WHERE case_id IN (${caseIds.map(() => "?").join(",")}) AND user_id IN (${userIds.map(() => "?").join(",")})`,
          ...caseIds,
          ...userIds,
        )
      : [];

  // Questionnaires linked to uni classes or exams
  const qForms = [];
  const qResponses = [];
  if (hasTable("questionnaire_forms") && (classIds.length || examIds.length)) {
    const conds = [];
    const params = [];
    if (classIds.length) {
      conds.push(`class_id IN (${classIds.map(() => "?").join(",")})`);
      params.push(...classIds);
    }
    if (examIds.length) {
      conds.push(`exam_id IN (${examIds.map(() => "?").join(",")})`);
      params.push(...examIds);
    }
    if (conds.length) {
      const formRows = rows(
        `SELECT * FROM questionnaire_forms WHERE ${conds.join(" OR ")}`,
        ...params,
      );
      qForms.push(...formRows);
      const fids = formRows.map((f) => f.id);
      if (fids.length && hasTable("questionnaire_responses")) {
        qResponses.push(
          ...rows(
            `SELECT * FROM questionnaire_responses WHERE form_id IN (${fids.map(() => "?").join(",")})`,
            ...fids,
          ),
        );
      }
    }
  }

  // Research linked to uni classes/exams or created by uni teachers
  const studyIdsFromContext = [
    ...classes.map((c) => c.study_id).filter(Boolean),
    ...exams.map((e) => e.study_id).filter(Boolean),
  ];
  const teacherIds = users.filter((u) => u.role === "teacher").map((u) => u.id);
  const studies = [];
  const researchEvents = [];
  const researchConsents = [];
  const researchControls = [];

  if (hasTable("research_studies")) {
    const sConds = [];
    const sParams = [];
    if (studyIdsFromContext.length) {
      sConds.push(`id IN (${studyIdsFromContext.map(() => "?").join(",")})`);
      sParams.push(...studyIdsFromContext);
    }
    if (teacherIds.length) {
      sConds.push(`created_by IN (${teacherIds.map(() => "?").join(",")})`);
      sParams.push(...teacherIds);
    }
    if (sConds.length) {
      studies.push(
        ...rows(`SELECT * FROM research_studies WHERE ${sConds.join(" OR ")}`, ...sParams),
      );
    }
    const allStudyIds = [...new Set(studies.map((s) => s.id))];
    if (allStudyIds.length) {
      if (hasTable("research_events")) {
        researchEvents.push(
          ...rows(
            `SELECT * FROM research_events WHERE study_id IN (${allStudyIds.map(() => "?").join(",")})`,
            ...allStudyIds,
          ),
        );
      }
      if (hasTable("research_consents")) {
        researchConsents.push(
          ...rows(
            `SELECT * FROM research_consents WHERE study_id IN (${allStudyIds.map(() => "?").join(",")})`,
            ...allStudyIds,
          ),
        );
      }
      if (hasTable("research_participation_controls")) {
        researchControls.push(
          ...rows(
            `SELECT * FROM research_participation_controls WHERE study_id IN (${allStudyIds.map(() => "?").join(",")})`,
            ...allStudyIds,
          ),
        );
      }
    }
  }

  // Virtual Patient sessions and session events
  const vpSessions = [];
  const vpEvents = [];
  if (hasTable("vp_sessions") && userIds.length && caseIds.length) {
    const sessRows = rows(
      `SELECT * FROM vp_sessions WHERE user_id IN (${userIds.map(() => "?").join(",")}) AND case_id IN (${caseIds.map(() => "?").join(",")})`,
      ...userIds,
      ...caseIds,
    );
    vpSessions.push(...sessRows);
    const sessIds = sessRows.map((s) => s.id);
    if (sessIds.length && hasTable("vp_session_events")) {
      vpEvents.push(
        ...rows(
          `SELECT * FROM vp_session_events WHERE session_id IN (${sessIds.map(() => "?").join(",")}) ORDER BY seq ASC`,
          ...sessIds,
        ),
      );
    }
  }

  return {
    university: {
      schema_version: finalPreview ? 1 : 2,
      source_university: onlyRow(uni, [
        "id",
        "name_fa",
        "name_en",
        "city_fa",
        "city_en",
        "code",
        "active",
      ]),
      exported_at: iso(),
      namespace,
    },
    references: refs,
    policies,
    checklists: checks,
    cases,
    case_versions: caseVersions,
    flashcards: cards,
    flashcard_versions: cardVersions,
    card_revisions: cardRevisions,
    classes,
    exams,
    class_cases: classCases,
    class_flashcards: classCards,
    identities: users,
    class_members: members,
    class_flashcard_attempts: classCardAttempts,
    exam_participants: examParticipants,
    exam_assignments: examAssignments,
    attempts,
    questionnaire_forms: qForms,
    questionnaire_responses: qResponses,
    research_studies: studies,
    research_events: researchEvents,
    research_consents: researchConsents,
    research_participation_controls: researchControls,
    vp_sessions: vpSessions,
    vp_session_events: vpEvents,
    scope: finalPreview ? {
      complete: false,
      restorable: false,
      included: [
        "academic content",
        "canonical-reference policies and provenance",
        "class/exam configuration",
        "academic identities without credentials",
        "class membership",
        "case attempts",
      ],
      excluded: [
        "passwords, JWTs, MFA and tokens",
        "platform learner data",
        "unconsented research session transcripts",
        "binary media",
        "case/flashcard history",
        "exam participants and direct assignments",
        "research forms, consents, events and studies",
        "virtual-patient session metadata and events",
        "class flashcard attempts",
      ],
      classification: "restricted",
    } : {
      complete: true,
      restorable: true,
      included: [
        "academic content and full version histories",
        "canonical-reference policies and provenance",
        "class and exam configuration, membership, attempts",
        "academic identities (students & teachers) without passwords",
        "virtual-patient sessions and telemetry events",
        "research studies, consents, and questionnaire forms",
        "binary media assets belonging to this university",
      ],
      excluded: [
        "passwords, JWTs, MFA and security auth secrets",
        "platform learner competitive progress",
      ],
      classification: "restricted",
    },
  };
}

export function createUniversityBundle(university, options = {}) {
  const isPreview = options.preview === true || options.format === "preview" || options.mode === "preview";
  const isFull = options.full === true || options.format === "full" || options.mode === "full";
  const finalPreview = !isFull;
  if (!university?.id) throw Error("university_required");
  const namespace = tenantNamespace(university);
  const payload = buildCompletePayload(university, namespace, finalPreview);
  const base = `academic/${namespace}/`;
  const entries = [];

  const entityFiles = {
    "university.json": payload.university,
    "reference-catalog.json": payload.references,
    "course-reference-policies.json": payload.policies,
    "checklists.json": payload.checklists,
    "cases.json": payload.cases,
    "case-versions.json": payload.case_versions,
    "flashcards.json": payload.flashcards,
    "flashcard-versions.json": payload.flashcard_versions,
    "card-revisions.json": payload.card_revisions,
    "classes.json": payload.classes,
    "exams.json": payload.exams,
    "class-cases.json": payload.class_cases,
    "class-flashcards.json": payload.class_flashcards,
    "academic-identities.json": payload.identities,
    "class-members.json": payload.class_members,
    "class-flashcard-attempts.json": payload.class_flashcard_attempts,
    "exam-participants.json": payload.exam_participants,
    "exam-assignments.json": payload.exam_assignments,
    "attempts.json": payload.attempts,
    "questionnaires.json": {
      forms: payload.questionnaire_forms,
      responses: payload.questionnaire_responses,
    },
    "research.json": {
      studies: payload.research_studies,
      events: payload.research_events,
      consents: payload.research_consents,
      controls: payload.research_participation_controls,
    },
    "vp-sessions.json": {
      sessions: payload.vp_sessions,
      events: payload.vp_session_events,
    },
    "scope.json": payload.scope,
  };

  for (const [name, value] of Object.entries(entityFiles)) {
    entries.push({ path: base + name, data: json(value) });
  }

    // Sync standalone tenant SQLite database into academic/<namespace>/university.db
  try {
    const tenantDbPath = path.join(ACADEMIC_DIR, namespace, "university.db");
    if (fs.existsSync(tenantDbPath)) {
      entries.push({ path: `${base}university.db`, data: fs.readFileSync(tenantDbPath) });
    }
  } catch (e) {
    /* best effort */
  }

  // Binary media from academic/<namespace>/media/
  const mediaDir = path.join(ACADEMIC_DIR, namespace, "media");
  if (fs.existsSync(mediaDir)) {
    const mFiles = fs.readdirSync(mediaDir);
    for (const mf of mFiles) {
      const fullP = path.join(mediaDir, mf);
      const st = fs.statSync(fullP);
      if (st.isFile()) {
        const data = fs.readFileSync(fullP);
        entries.push({ path: `${base}media/${mf}`, data });
      }
    }
  }

  entries.push({
    path: base + "README.fa.md",
    data: Buffer.from(
      "# بسته جامع دانشگاهی قابل‌حمل (Academic Portable Package)\n\nاین بسته حاوی ساختار کامل، تاریخچه‌ها، مراجع علمی، جلسات بیمار مجازی و رسانه‌های دانشگاه است و قابلیت بازیابی کامل در سرور دیگر را دارد.\n",
      "utf8",
    ),
  });

  entries.push({
    path: "learning/README.fa.md",
    data: Buffer.from(
      "# حوزه مستقل Learning\n\nاین پوشه جهت تفکیک سطح ریشه میان داده‌های دانشگاهی (Academic) و مسیر یادگیری رقابتی (Learning) تعبیه شده است.\n",
      "utf8",
    ),
  });

  const files = entries
    .map((e) => ({ path: e.path, sha256: digest(e.data), size: e.data.length }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    schema: finalPreview ? "medschool.university-preview.v1" : "medschool.university-portable.v2",
    bundle_id: crypto.randomUUID(),
    created_at: iso(),
    source: {
      namespace,
      university_id: Number(university.id),
      university_code: university.code || "",
    },
    roots: ["academic", "learning"],
    scope: payload.scope,
    files,
  };

  const mb = json(manifest);
  entries.push(
    { path: "manifest.json", data: mb },
    {
      path: "manifest.sha256",
      data: Buffer.from(`${digest(mb)}  manifest.json\n`, "utf8"),
    },
  );

  return { buffer: createPortableZip(entries), manifest, namespace };
}

/* Learning Path Package Export */
export function createLearningBundle() {
  const topics = rows("SELECT * FROM topics ORDER BY ord, id");
  const topicIds = topics.map((t) => t.id);
  const nodes = topicIds.length
    ? rows(
        `SELECT * FROM path_nodes WHERE topic_id IN (${topicIds.map(() => "?").join(",")}) ORDER BY ord, id`,
        ...topicIds,
      )
    : [];

  const base = "learning/";
  const entries = [
    { path: base + "topics.json", data: json(topics) },
    { path: base + "path-nodes.json", data: json(nodes) },
    {
      path: base + "README.fa.md",
      data: Buffer.from(
        "# بسته مسیر یادگیری رقابتی (Learning Path Package)\n\nشامل سرفصل‌ها (Topics) و گره‌های نقشه یادگیری (Path Nodes).\n",
        "utf8",
      ),
    },
  ];

  const files = entries
    .map((e) => ({ path: e.path, sha256: digest(e.data), size: e.data.length }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    schema: "medschool.learning-package.v1",
    bundle_id: crypto.randomUUID(),
    created_at: iso(),
    roots: ["learning"],
    scope: {
      complete: true,
      restorable: true,
      included: ["topics", "path_nodes"],
    },
    files,
  };

  const mb = json(manifest);
  entries.push(
    { path: "manifest.json", data: mb },
    {
      path: "manifest.sha256",
      data: Buffer.from(`${digest(mb)}  manifest.json\n`, "utf8"),
    },
  );

  return { buffer: createPortableZip(entries), manifest };
}

// Empty legacy fields mean no explicit selection. Non-empty values must be
// JSON ID arrays; never retain unparsed or unmapped source IDs in the target.
function examContentIds(raw, field) {
  if (raw == null || raw === "") return [];
  let ids;
  try { ids = typeof raw === "string" ? JSON.parse(raw) : null; } catch { /* invalid below */ }
  if (!Array.isArray(ids) || ids.some(id =>
    !["number", "string"].includes(typeof id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1
  )) throw Error(`exam_${field}_invalid`);
  return ids.map(Number);
}

function validateEntityShapes(data) {
  const arrays = [
    "references",
    "policies",
    "checklists",
    "cases",
    "flashcards",
    "classes",
    "exams",
    "class_cases",
    "class_flashcards",
    "identities",
    "class_members",
    "attempts",
  ];
  for (const k of arrays) asArray(data[k], k);
  const sid = Number(data.university.source_university?.id);
  if (!Number.isInteger(sid) || sid < 1)
    throw Error("invalid_source_university");

  const checkTenant = (list, label) => {
    for (const x of list) {
      if (Number(x.university_id) !== sid) throw Error(`cross_tenant_${label}`);
    }
  };

  checkTenant(data.identities, "identity");
  checkTenant(data.policies, "policy");
  checkTenant(data.cases, "case");
  checkTenant(data.flashcards, "flashcard");
  checkTenant(data.classes, "class");
  checkTenant(data.exams, "exam");

  // Every remapped entity needs a unique, positive source identity. Otherwise
  // Map.set silently redirects dependent history to the last duplicate row.
  for (const key of ["references", "policies", "checklists", "cases", "flashcards", "classes", "exams", "identities"]) {
    const seen = new Set();
    for (const row of data[key]) {
      const id = Number(key === "identities" ? row.source_user_id || row.id : row.id);
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) throw Error(`${key}_identity_invalid`);
      seen.add(id);
    }
  }

  const rids = new Set(data.references.map((x) => Number(x.id)));
  const pids = new Set(data.policies.map((x) => Number(x.id)));
  const cids = new Set(data.cases.map((x) => Number(x.id)));
  const fids = new Set(data.flashcards.map((x) => Number(x.id)));
  const clids = new Set(data.classes.map((x) => Number(x.id)));
  const examIds = new Set(data.exams.map((x) => Number(x.id)));
  const validContext = row =>
    (row.class_id == null || clids.has(Number(row.class_id))) &&
    (row.exam_id == null || examIds.has(Number(row.exam_id)));
  for (const version of asArray(data.case_versions, "case_versions")) {
    if (!cids.has(Number(version.case_id))) throw Error("case_version_graph_invalid");
  }
  for (const version of asArray(data.flashcard_versions, "flashcard_versions")) {
    if (!fids.has(Number(version.flashcard_id))) throw Error("flashcard_version_graph_invalid");
  }
  const uids = new Set(
    data.identities.map((x) => Number(x.source_user_id || x.id)),
  );

  for (const p of data.policies) {
    if (p.reference_id && !rids.has(Number(p.reference_id)))
      throw Error("policy_reference_missing");
    if (!["draft", "approved", "retired", "blocked"].includes(p.status))
      throw Error("policy_status_invalid");
  }

  for (const c of data.cases) {
    if (c.reference_policy_id && !pids.has(Number(c.reference_policy_id)))
      throw Error("case_policy_missing");
    try {
      const d = JSON.parse(c.data_json || "{}");
      if (d.track === "learn") throw Error();
    } catch {
      throw Error("invalid_or_learning_case");
    }
    if (c.reference_snapshot_json) {
      const s = parseReferenceSnapshot(c.reference_snapshot_json);
      if (s.status === "integrity_failed")
        throw Error("case_snapshot_integrity_failed");
    }
  }

  // Context IDs are foreign keys selected by context_type, not globally stable IDs.
  const contextIds = new Map([
    ["class", clids], ["exam", examIds], ["case", cids],
    ["study", new Set(asArray(data.research?.studies || [], "research.studies").map(s => Number(s.id)))],
  ]);
  for (const [rows, label] of [
    [data.questionnaires?.responses || [], "questionnaire"],
    [data.research?.events || [], "research_event"],
  ]) {
    for (const row of asArray(rows, label)) {
      const ids = contextIds.get(row.context_type);
      if (ids && row.context_id != null && !ids.has(Number(row.context_id))) {
        throw Error(`${label}_context_invalid`);
      }
    }
  }

  for (const exam of data.exams) {
    for (const [field, ids, label] of [
      ["case_ids", cids, "case"], ["flashcard_ids", fids, "flashcard"],
    ]) {
      if (examContentIds(exam[field], field).some(id => !ids.has(id))) {
        throw Error(`exam_${label}_graph_invalid`);
      }
    }
  }

  const attemptsById = new Map();
  for (const attempt of data.attempts) {
    const id = Number(attempt.id);
    if (!Number.isSafeInteger(id) || id < 1 || attemptsById.has(id)) throw Error("attempt_identity_invalid");
    if (!validContext(attempt)) throw Error("attempt_context_invalid");
    attemptsById.set(id, attempt);
  }
  const sessions = asArray(data.vp_sessions?.sessions || [], "vp_sessions.sessions");
  const sessionIds = new Set();
  for (const session of sessions) {
    const id = Number(session.id);
    if (!Number.isSafeInteger(id) || id < 1 || sessionIds.has(id) ||
        !uids.has(Number(session.user_id)) || !cids.has(Number(session.case_id))) throw Error("session_graph_invalid");
    if (!validContext(session)) throw Error("session_context_invalid");
    sessionIds.add(id);
    if (session.encounter_snapshot_json) readEncounter(session);
    if (session.attempt_id != null) {
      const attempt = attemptsById.get(Number(session.attempt_id));
      if (!attempt || ["user_id", "case_id", "class_id", "exam_id"].some(k => Number(session[k] || 0) !== Number(attempt[k] || 0))) {
        throw Error("session_attempt_graph_invalid");
      }
    }
  }
  for (const event of asArray(data.vp_sessions?.events || [], "vp_sessions.events")) {
    if (!sessionIds.has(Number(event.session_id))) throw Error("session_event_graph_invalid");
  }

  for (const c of data.flashcards) {
    try {
      if (JSON.parse(c.data_json || "{}").track === "learn") throw Error();
    } catch {
      throw Error("invalid_or_learning_flashcard");
    }
  }

  for (const x of data.class_cases) {
    if (!clids.has(Number(x.class_id)) || !cids.has(Number(x.case_id)))
      throw Error("class_case_graph_invalid");
  }
  for (const x of data.class_flashcards) {
    if (!clids.has(Number(x.class_id)) || !fids.has(Number(x.flashcard_id)))
      throw Error("class_flashcard_graph_invalid");
  }
  for (const x of data.class_members) {
    if (!clids.has(Number(x.class_id)) || !uids.has(Number(x.user_id)))
      throw Error("class_member_graph_invalid");
  }
  for (const x of data.attempts) {
    if (!cids.has(Number(x.case_id)) || !uids.has(Number(x.user_id)))
      throw Error("attempt_graph_invalid");
  }
}

export function validateUniversityBundle(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || "");
  if (buffer.length < 22 || buffer.length > MAX_BUNDLE)
    throw Error("bundle_size_invalid");

  const files = bundleFileMap(
    readPortableZip(buffer, {
      maxEntries: 1000,
      maxEntryBytes: MAX_JSON,
      maxExpandedBytes: MAX_BUNDLE * 3,
    }),
  );

  const manifestBuf = files.get("manifest.json");
  const sumBuf = files.get("manifest.sha256");
  if (!manifestBuf || !sumBuf) throw Error("manifest_missing");

  const match = sumBuf
    .toString("utf8")
    .trim()
    .match(/^([a-f0-9]{64})\s+manifest\.json$/);
  if (!match || digest(manifestBuf) !== match[1])
    throw Error("manifest_checksum_invalid");

  const manifest = parseJson(manifestBuf, "manifest");
  const isV2 = manifest.schema === "medschool.university-portable.v2";
  const isV1 = manifest.schema === "medschool.university-preview.v1";

  if (!isV2 && !isV1) throw Error("manifest_schema_invalid");
  if (!Array.isArray(manifest.files) || !manifest.source?.namespace)
    throw Error("manifest_schema_invalid");

  const ns = safeArchivePath(manifest.source.namespace);
  if (!ns || ns.includes("/")) throw Error("manifest_namespace_invalid");

  const allow = new Set(["manifest.json", "manifest.sha256"]);
  for (const f of manifest.files || []) {
    if (
      !f ||
      typeof f.path !== "string" ||
      !safeArchivePath(f.path) ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !Number.isInteger(f.size) ||
      f.size < 0
    ) {
      throw Error("manifest_file_invalid");
    }
    if (allow.has(f.path)) throw Error("duplicate_manifest_path");
    allow.add(f.path);

    const b = files.get(f.path);
    if (!b || b.length !== f.size || digest(b) !== f.sha256)
      throw Error(`file_checksum_invalid:${f.path}`);
  }

  for (const p of files.keys()) {
    if (!allow.has(p)) throw Error(`undeclared_bundle_file:${p}`);
    if (
      !(
        p.startsWith(`academic/${ns}/`) ||
        p.startsWith("learning/") ||
        p === "manifest.json" ||
        p === "manifest.sha256"
      )
    ) {
      throw Error("bundle_root_invalid");
    }
  }

  const get = (n, optional = false) => {
    const p = entityPath(ns, n);
    const b = files.get(p);
    if (!b) {
      if (optional) return null;
      throw Error(`missing_entity:${n}`);
    }
    return parseJson(b, n);
  };

  const data = {
    university: get("university.json"),
    references: get("reference-catalog.json"),
    policies: get("course-reference-policies.json"),
    checklists: get("checklists.json"),
    cases: get("cases.json"),
    case_versions: get("case-versions.json", true) || [],
    flashcards: get("flashcards.json"),
    flashcard_versions: get("flashcard-versions.json", true) || [],
    card_revisions: get("card-revisions.json", true) || [],
    classes: get("classes.json"),
    exams: get("exams.json"),
    class_cases: get("class-cases.json"),
    class_flashcards: get("class-flashcards.json"),
    identities: get("academic-identities.json"),
    class_members: get("class-members.json"),
    class_flashcard_attempts: get("class-flashcard-attempts.json", true) || [],
    exam_participants: get("exam-participants.json", true) || [],
    exam_assignments: get("exam-assignments.json", true) || [],
    attempts: get("attempts.json"),
    questionnaires: get("questionnaires.json", true) || { forms: [], responses: [] },
    research: get("research.json", true) || { studies: [], events: [], consents: [], controls: [] },
    vp_sessions: get("vp-sessions.json", true) || { sessions: [], events: [] },
    scope: get("scope.json"),
  };

  if (
    data.university.namespace !== ns ||
    Number(manifest.source.university_id) !==
      Number(data.university.source_university?.id)
  ) {
    throw Error("source_identity_mismatch");
  }

  validateEntityShapes(data);

  // Collect media files
  const mediaEntries = [];
  const mediaPrefix = `academic/${ns}/media/`;
  for (const [k, v] of files.entries()) {
    if (k.startsWith(mediaPrefix)) {
      const fileName = path.basename(k);
      mediaEntries.push({ name: fileName, data: v });
    }
  }

  return {
    ok: true,
    restorable: isV2,
    schema: manifest.schema,
    manifest,
    data,
    mediaEntries,
    warnings: data.policies
      .filter((p) => p.status !== "approved")
      .map((p) => ({ code: "policy_not_approved", policy_id: p.id })),
  };
}

/* Transactional Importer with Staging & ID Remapping */
export async function importUniversityBundle(buffer, options = {}) {
  const checked = validateUniversityBundle(buffer);
  if (!checked.restorable) {
    const err = new Error("incomplete_portable_format_import_disabled");
    err.status = 400;
    throw err;
  }

  const { data, mediaEntries, manifest } = checked;
  const srcUni = data.university.source_university;
  ensureDataDirs();

  // Create staging directory
  const stageId = crypto.randomUUID();
  const stagingDir = path.join(PORTABLE_STAGING_DIR, stageId);
  fs.mkdirSync(stagingDir, { recursive: true, mode: 0o700 });

  const createdMedia = [];
  const createdDirectories = [];
  try {
    // Stage media files first. Never silently overwrite colliding bundle names.
    const stagedMedia = [];
    const stagedNames = new Set();
    for (const me of mediaEntries) {
      const name = safeFileName(me.name);
      if (stagedNames.has(name)) throw Error("duplicate_media_name");
      stagedNames.add(name);
      const dest = path.join(stagingDir, name);
      fs.writeFileSync(dest, me.data);
      stagedMedia.push({ name: me.name, path: dest });
    }

    // File writes below are synchronous and compensated on ordinary failures.
    // The DB is acknowledged only after the entire restore is on disk.
    return durableTransaction(() => {

    let targetUniId = null;
    let targetNs = null;

    if (options.target_university_id) {
      const existing = db
        .prepare("SELECT * FROM universities WHERE id=?")
        .get(options.target_university_id);
      if (!existing) throw new Error("target_university_not_found");
      targetUniId = existing.id;
      targetNs = namespaceForUniversity(targetUniId);
    } else {
      // When importing without specifying target_university_id, create a fresh destination university
      // using a distinct code to avoid collisions with source university on the same instance
      let newCode = srcUni.code ? `${srcUni.code}_imported_${Date.now().toString(36)}` : `uni_${Date.now().toString(36)}`;
      const ins = db
        .prepare(
          `INSERT INTO universities (name_fa, name_en, city_fa, city_en, code, active)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          srcUni.name_fa ? `${srcUni.name_fa} (وارداتی)` : "دانشگاه وارداتی",
          srcUni.name_en ? `${srcUni.name_en} (Imported)` : "Imported University",
          srcUni.city_fa || "",
          srcUni.city_en || "",
          newCode,
          srcUni.active ?? 1,
        );
      targetUniId = Number(ins.lastInsertRowid);
      targetNs = namespaceForUniversity(targetUniId);
    }

    const destRoot = path.join(ACADEMIC_DIR, targetNs);
    for (const dir of [destRoot, ...["exports", "imports", "media"].map(n => path.join(destRoot, n))]) {
      if (!fs.existsSync(dir)) createdDirectories.push(dir);
    }
    const destDirs = namespaceDirs(targetNs);
    const sourcePrefix = `/uploads/academic/${manifest.source.namespace}/`;
    const targetPrefix = `/uploads/academic/${targetNs}/`;
    const remapMedia = value => {
      if (typeof value === "string") return value.startsWith(sourcePrefix) ? targetPrefix + value.slice(sourcePrefix.length) : value;
      if (Array.isArray(value)) {
        const mapped = value.map(remapMedia);
        return mapped.every((v, i) => v === value[i]) ? value : mapped;
      }
      if (value && typeof value === "object") {
        const entries = Object.entries(value), mapped = entries.map(([k, v]) => [k, remapMedia(v)]);
        return mapped.every(([, v], i) => v === entries[i][1]) ? value : Object.fromEntries(mapped);
      }
      return value;
    };
    const remapMediaJson = raw => {
      if (typeof raw !== "string") return raw;
      const original = JSON.parse(raw), mapped = remapMedia(original);
      return mapped === original ? raw : JSON.stringify(mapped);
    };

    // ID Remap tables
    const userMap = new Map(); // srcId -> targetId
    const refMap = new Map();
    const policyMap = new Map();
    const checkMap = new Map();
    const caseMap = new Map();
    const cardMap = new Map();
    const classMap = new Map();
    const examMap = new Map();
    const studyMap = new Map();
    const formMap = new Map();
    const sessionMap = new Map();
    const attemptMap = new Map();

    // 1. Users
    for (const u of data.identities) {
      const srcId = Number(u.source_user_id || u.id);
      let targetUsername = u.username;
      let existingUser = db.prepare("SELECT id, university_id FROM users WHERE username=?").get(u.username);
      if (existingUser) {
        if (existingUser.university_id === targetUniId) {
          userMap.set(srcId, existingUser.id);
          continue;
        }
        // Disambiguate username to keep tenant accounts strictly isolated
        targetUsername = `${u.username}_${targetNs.replace(/[^a-zA-Z0-9]/g, "")}`;
      }

      let targetStudentNo = u.student_no;
      if (targetStudentNo) {
        const existsSn = db.prepare("SELECT id FROM users WHERE student_no=?").get(targetStudentNo);
        if (existsSn) {
          targetStudentNo = `${targetStudentNo}_${targetNs.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 20);
          if (db.prepare("SELECT id FROM users WHERE student_no=?").get(targetStudentNo)) targetStudentNo = null;
        }
      }
      const dummyHash = `$2a$10$${crypto.randomBytes(16).toString("hex")}`;
      const insU = db
        .prepare(
          `INSERT INTO users (username, password_hash, name_fa, name_en, student_no, role, status, created_at, university_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          targetUsername,
          dummyHash,
          u.name_fa,
          u.name_en,
          targetStudentNo,
          u.role,
          u.status || "active",
          u.created_at || iso(),
          targetUniId,
        );
      userMap.set(srcId, Number(insU.lastInsertRowid));
    }

    // 2. Reference Catalog
    for (const r of data.references) {
      const srcId = Number(r.id);
      const refCode = r.code ?? r.course_code ?? r.title_en ?? `ref-${srcId}`;
      let existing = db
        .prepare(
          "SELECT id FROM reference_catalog WHERE code=? AND title_fa=?",
        )
        .get(refCode, r.title_fa);
      if (existing) {
        refMap.set(srcId, existing.id);
      } else {
        const insR = db
          .prepare(
            `INSERT INTO reference_catalog (code, title_fa, title_en, edition, publication_year, publisher, source_url, rights_status, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            refCode,
            r.title_fa || "",
            r.title_en || "",
            r.edition || "",
            r.publication_year || null,
            r.publisher || "",
            r.source_url ?? r.official_url ?? "",
            r.rights_status || "metadata_only",
            r.active ?? 1,
          );
        refMap.set(srcId, Number(insR.lastInsertRowid));
      }
    }

    // 3. Course Reference Policies
    for (const p of data.policies) {
      const srcId = Number(p.id);
      const targetRefId = p.reference_id ? refMap.get(Number(p.reference_id)) : null;
      const insP = db
        .prepare(
          `INSERT OR REPLACE INTO course_reference_policies (
            university_id, course_code, course_name_fa, course_name_en, specialty_fa, specialty_en,
            reference_id, source_anchor, citation_label_fa, citation_label_en, teaching_basis_fa,
            teaching_basis_en, content_mode, status, approval_note, approved_by, approved_at,
            version, active, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          targetUniId,
          p.course_code,
          p.course_name_fa,
          p.course_name_en,
          p.specialty_fa || "",
          p.specialty_en || "",
          targetRefId,
          p.source_anchor || "",
          p.citation_label_fa || "",
          p.citation_label_en || "",
          p.teaching_basis_fa || "",
          p.teaching_basis_en || "",
          p.content_mode || "teacher_authored",
          p.status || "approved",
          p.approval_note || "",
          p.approved_by ? userMap.get(Number(p.approved_by)) || null : null,
          p.approved_at,
          p.version || 1,
          p.active ?? 1,
          p.created_by ? userMap.get(Number(p.created_by)) || null : null,
          p.created_at || iso(),
          p.updated_at || iso(),
        );
      policyMap.set(srcId, Number(insP.lastInsertRowid));
    }

    // 4. Checklists
    for (const c of data.checklists) {
      const srcId = Number(c.id);
      const targetOwner = c.owner_id ? userMap.get(Number(c.owner_id)) : null;
      const insC = db
        .prepare(
          `INSERT INTO checklists (name_fa, name_en, items_json, owner_id)
           VALUES (?, ?, ?, ?)`,
        )
        .run(c.name_fa, c.name_en, c.items_json, targetOwner);
      checkMap.set(srcId, Number(insC.lastInsertRowid));
    }

    // 5. Cases & Versions
    for (const c of data.cases) {
      const srcId = Number(c.id);
      const targetCheckId = c.checklist_id ? checkMap.get(Number(c.checklist_id)) : null;
      const targetPolicyId = c.reference_policy_id ? policyMap.get(Number(c.reference_policy_id)) : null;

      // Reseal reference snapshot if policy changed
      let snap = c.reference_snapshot_json;
      if (targetPolicyId) {
        const fresh = referenceSnapshotForPolicy(targetPolicyId);
        if (fresh && fresh.json) {
          snap = fresh.json;
        }
      }

      const insCase = db
        .prepare(
          `INSERT INTO cases (version, difficulty, checklist_id, data_json, active, updated_at, university_id, reference_policy_id, reference_snapshot_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          c.version || 1,
          c.difficulty,
          targetCheckId,
          remapMediaJson(c.data_json),
          c.active ?? 1,
          c.updated_at || iso(),
          targetUniId,
          targetPolicyId,
          snap,
        );
      caseMap.set(srcId, Number(insCase.lastInsertRowid));
    }

    if (hasTable("case_versions") && Array.isArray(data.case_versions)) {
      for (const cv of data.case_versions) {
        const targetCaseId = caseMap.get(Number(cv.case_id));
        if (targetCaseId) {
          db.prepare(
            `INSERT INTO case_versions (case_id, version, data_json, archived_at)
             VALUES (?, ?, ?, ?)`,
          ).run(targetCaseId, cv.version, remapMediaJson(cv.data_json), cv.archived_at || iso());
        }
      }
    }

    // 6. Flashcards, Versions, Revisions
    for (const f of data.flashcards) {
      const srcId = Number(f.id);
      const insCard = db
        .prepare(
          `INSERT INTO flashcards (version, difficulty, data_json, active, updated_at, university_id, created_at, content_updated_at, revision, last_editor_id, last_action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          f.version || 1,
          f.difficulty,
          remapMediaJson(f.data_json),
          f.active ?? 1,
          f.updated_at || iso(),
          targetUniId,
          f.created_at || iso(),
          f.content_updated_at || iso(),
          f.revision || 1,
          f.last_editor_id ? userMap.get(Number(f.last_editor_id)) || null : null,
          f.last_action || "import",
        );
      cardMap.set(srcId, Number(insCard.lastInsertRowid));
    }

    if (hasTable("flashcard_versions") && Array.isArray(data.flashcard_versions)) {
      for (const fv of data.flashcard_versions) {
        const targetCardId = cardMap.get(Number(fv.flashcard_id));
        if (targetCardId) {
          db.prepare(
            `INSERT INTO flashcard_versions (flashcard_id, version, data_json, archived_at)
             VALUES (?, ?, ?, ?)`,
          ).run(targetCardId, fv.version, remapMediaJson(fv.data_json), fv.archived_at || iso());
        }
      }
    }

    if (hasTable("card_revisions") && Array.isArray(data.card_revisions)) {
      for (const cr of data.card_revisions) {
        const targetCardId = cardMap.get(Number(cr.card_id));
        if (targetCardId) {
          db.prepare(
            `INSERT INTO card_revisions (card_id, revision, action, fields, actor_id, actor_name, subject, chapter, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            targetCardId,
            cr.revision,
            cr.action,
            cr.fields,
            cr.actor_id ? userMap.get(Number(cr.actor_id)) || null : null,
            cr.actor_name,
            cr.subject,
            cr.chapter,
            cr.note,
            cr.created_at || iso(),
          );
        }
      }
    }

    // 7. Research Studies
    const rData = data.research || {};
    if (hasTable("research_studies") && Array.isArray(rData.studies)) {
      for (const s of rData.studies) {
        const srcId = Number(s.id);
        const insS = db
          .prepare(
            `INSERT INTO research_studies (
              title_fa, title_en, description_fa, description_en, domain, active,
              consent_required, created_by, created_at, updated_at, ethics_code,
              protocol_version, consent_text_fa, consent_text_en, consent_admin_managed,
              consent_modes, anonymize
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            s.title_fa,
            s.title_en,
            s.description_fa,
            s.description_en,
            s.domain || "general",
            s.active ?? 0,
            s.consent_required ?? 1,
            s.created_by ? userMap.get(Number(s.created_by)) || null : null,
            s.created_at || iso(),
            s.updated_at || iso(),
            s.ethics_code,
            s.protocol_version,
            s.consent_text_fa,
            s.consent_text_en,
            s.consent_admin_managed ?? 0,
            s.consent_modes,
            s.anonymize ?? 0,
          );
        studyMap.set(srcId, Number(insS.lastInsertRowid));
      }
    }

    // 8. Classes
    for (const c of data.classes) {
      const srcId = Number(c.id);
      const targetStudyId = c.study_id ? studyMap.get(Number(c.study_id)) || null : null;
      const targetOwner = c.owner_id ? userMap.get(Number(c.owner_id)) || null : null;
      let targetCode = c.code;
      if (targetCode) {
        const existsCode = db.prepare("SELECT id FROM classes WHERE code=?").get(targetCode);
        if (existsCode) {
          targetCode = `${targetCode}_${targetNs.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now().toString().slice(-4)}`.slice(0, 64);
          if (db.prepare("SELECT id FROM classes WHERE code=?").get(targetCode)) {
            targetCode = `${targetCode}_${Math.random().toString(36).slice(2,6)}`.slice(0,64);
          }
        }
      }
      const insCls = db
        .prepare(
          `INSERT INTO classes (
            name_fa, name_en, desc_fa, desc_en, code, owner_id, max_attempts,
            active, created_at, live_board_enabled, live_board_anonymous,
            university_id, grading_role, history_form, grading_json,
            tutor_enabled, tutor_prompt, log_transcript, study_id,
            exam_mode, timer_enabled, timer_minutes, flash_no_penalty, live_board_speed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          c.name_fa,
          c.name_en,
          c.desc_fa,
          c.desc_en,
          targetCode,
          targetOwner,
          c.max_attempts,
          c.active ?? 1,
          c.created_at || iso(),
          c.live_board_enabled ?? 0,
          c.live_board_anonymous ?? 1,
          targetUniId,
          c.grading_role,
          c.history_form,
          c.grading_json,
          c.tutor_enabled ?? 0,
          c.tutor_prompt,
          c.log_transcript ?? 0,
          targetStudyId,
          // Older bundles lack these fields; match schema defaults, while
          // keeping explicit zero and nullable per-class overrides intact.
          c.exam_mode ?? "perQuestion",
          c.timer_enabled ?? 1,
          c.timer_minutes ?? 30,
          c.flash_no_penalty ?? null,
          c.live_board_speed ?? null,
        );
      classMap.set(srcId, Number(insCls.lastInsertRowid));
    }

    // 9. Exams
    for (const e of data.exams) {
      const srcId = Number(e.id);
      const targetStudyId = e.study_id ? studyMap.get(Number(e.study_id)) || null : null;
      const targetOwner = e.owner_id ? userMap.get(Number(e.owner_id)) || null : null;

      // Validation above guarantees all selected content is in this archive.
      const mapSelection = (field, map) => JSON.stringify(examContentIds(e[field], field).map(id => {
        const target = map.get(id);
        if (target == null) throw Error("exam_content_mapping_missing");
        return target;
      }));
      const remappedCaseIds = mapSelection("case_ids", caseMap);
      const remappedCardIds = mapSelection("flashcard_ids", cardMap);

      const insEx = db
        .prepare(
          `INSERT INTO exams (
            title_fa, title_en, desc_fa, desc_en, case_ids, flashcard_ids,
            use_flashcards, starts_at, ends_at, duration_min, max_attempts,
            lang, shuffle, anti_cheat, competition, show_correct, show_hints,
            show_ai, show_micro, owner_id, active, created_at, university_id,
            tutor_enabled, tutor_prompt, log_transcript, study_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          e.title_fa,
          e.title_en,
          e.desc_fa,
          e.desc_en,
          remappedCaseIds,
          remappedCardIds,
          e.use_flashcards ?? 0,
          e.starts_at,
          e.ends_at,
          e.duration_min,
          e.max_attempts,
          e.lang,
          e.shuffle ?? 0,
          e.anti_cheat ?? 0,
          e.competition ?? 0,
          e.show_correct ?? 1,
          e.show_hints ?? 1,
          e.show_ai ?? 1,
          e.show_micro ?? 1,
          targetOwner,
          e.active ?? 1,
          e.created_at || iso(),
          targetUniId,
          e.tutor_enabled ?? 0,
          e.tutor_prompt,
          e.log_transcript ?? 0,
          targetStudyId,
        );
      examMap.set(srcId, Number(insEx.lastInsertRowid));
    }

    // 10. Class Cases, Class Cards, Class Members
    for (const cc of data.class_cases) {
      const tClass = classMap.get(Number(cc.class_id));
      const tCase = caseMap.get(Number(cc.case_id));
      if (tClass && tCase) {
        db.prepare(
          `INSERT INTO class_cases (class_id, case_id, weight) VALUES (?, ?, ?)`,
        ).run(tClass, tCase, cc.weight ?? 1);
      }
    }

    if (hasTable("class_flashcards")) {
      for (const cf of data.class_flashcards) {
        const tClass = classMap.get(Number(cf.class_id));
        const tCard = cardMap.get(Number(cf.flashcard_id));
        if (tClass && tCard) {
          db.prepare(
            `INSERT INTO class_flashcards (class_id, flashcard_id, weight, graded) VALUES (?, ?, ?, ?)`,
          ).run(tClass, tCard, cf.weight ?? 1, cf.graded ?? 1);
        }
      }
    }

    for (const cm of data.class_members) {
      const tClass = classMap.get(Number(cm.class_id));
      const tUser = userMap.get(Number(cm.user_id));
      if (tClass && tUser) {
        db.prepare(
          `INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)`,
        ).run(tClass, tUser, cm.joined_at || iso());
      }
    }

    // 11. Class Flashcard Attempts
    if (hasTable("class_flashcard_attempts") && Array.isArray(data.class_flashcard_attempts)) {
      for (const cfa of data.class_flashcard_attempts) {
        const tClass = classMap.get(Number(cfa.class_id));
        const tCard = cardMap.get(Number(cfa.flashcard_id));
        const tUser = userMap.get(Number(cfa.user_id));
        if (tClass && tCard && tUser) {
          db.prepare(
            `INSERT INTO class_flashcard_attempts (class_id, flashcard_id, user_id, score, answers_json, duration_sec, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            tClass,
            tCard,
            tUser,
            cfa.score,
            cfa.answers_json,
            cfa.duration_sec,
            cfa.created_at || iso(),
          );
        }
      }
    }

    // 12. Exam Participants and Assignments
    if (hasTable("exam_participants") && Array.isArray(data.exam_participants)) {
      for (const ep of data.exam_participants) {
        const tExam = examMap.get(Number(ep.exam_id));
        const tUser = userMap.get(Number(ep.user_id));
        if (tExam && tUser) {
          db.prepare(
            `INSERT INTO exam_participants (exam_id, user_id) VALUES (?, ?)`,
          ).run(tExam, tUser);
        }
      }
    }

    if (hasTable("exam_assignments") && Array.isArray(data.exam_assignments)) {
      for (const ea of data.exam_assignments) {
        const tUser = userMap.get(Number(ea.user_id));
        const tCase = caseMap.get(Number(ea.case_id));
        if (tUser && tCase) {
          db.prepare(
            `INSERT INTO exam_assignments (user_id, case_id, assigned_by, max_attempts, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            tUser,
            tCase,
            ea.assigned_by ? userMap.get(Number(ea.assigned_by)) || null : null,
            ea.max_attempts,
            ea.active ?? 1,
            ea.created_at || iso(),
          );
        }
      }
    }

    // 13. Case Attempts
    for (const a of data.attempts) {
      const tUser = userMap.get(Number(a.user_id));
      const tCase = caseMap.get(Number(a.case_id));
      const tClass = a.class_id ? classMap.get(Number(a.class_id)) || null : null;
      const tExam = a.exam_id ? examMap.get(Number(a.exam_id)) || null : null;
      if (tUser && tCase) {
        const insertedAttempt = db.prepare(
          `INSERT INTO attempts (
            user_id, type, case_id, class_id, exam_id, content_version, score,
            transcript_json, eval_json, turns, tests, imaging_count, ddx_count,
            hints, total_questions, correct_count, wrong_count, duration_sec,
            lang, created_at, teacher_status, teacher_score, teacher_feedback,
            reviewed_by, reviewed_at, reference_snapshot_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          tUser,
          a.type || "case",
          tCase,
          tClass,
          tExam,
          a.content_version || 1,
          a.score,
          a.transcript_json,
          a.eval_json,
          a.turns,
          a.tests,
          a.imaging_count,
          a.ddx_count,
          a.hints,
          a.total_questions,
          a.correct_count,
          a.wrong_count,
          a.duration_sec,
          a.lang,
          a.created_at || iso(),
          a.teacher_status,
          a.teacher_score,
          a.teacher_feedback,
          a.reviewed_by ? userMap.get(Number(a.reviewed_by)) || null : null,
          a.reviewed_at,
          a.reference_snapshot_json,
        );
        attemptMap.set(Number(a.id), Number(insertedAttempt.lastInsertRowid));
      }
    }

    const contextMaps = new Map([
      ["class", classMap], ["exam", examMap], ["case", caseMap], ["study", studyMap],
    ]);
    const remapContextId = row => {
      const map = contextMaps.get(row.context_type);
      if (!map || row.context_id == null) return row.context_id;
      const target = map.get(Number(row.context_id));
      if (target == null) throw Error("context_mapping_missing");
      return target;
    };

    // 14. Questionnaires
    const qData = data.questionnaires || {};
    if (hasTable("questionnaire_forms") && Array.isArray(qData.forms)) {
      for (const qf of qData.forms) {
        const srcId = Number(qf.id);
        const tClass = qf.class_id ? classMap.get(Number(qf.class_id)) || null : null;
        const tExam = qf.exam_id ? examMap.get(Number(qf.exam_id)) || null : null;
        const insQ = db
          .prepare(
            `INSERT INTO questionnaire_forms (
              title_fa, title_en, description_fa, description_en, scope,
              class_id, exam_id, questions_json, active, require_after_finish,
              anonymous, created_by, created_at, updated_at, template_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            qf.title_fa,
            qf.title_en,
            qf.description_fa,
            qf.description_en,
            qf.scope || "general",
            tClass,
            tExam,
            qf.questions_json,
            qf.active ?? 1,
            qf.require_after_finish ?? 1,
            qf.anonymous ?? 1,
            qf.created_by ? userMap.get(Number(qf.created_by)) || null : null,
            qf.created_at || iso(),
            qf.updated_at || iso(),
            qf.template_key,
          );
        formMap.set(srcId, Number(insQ.lastInsertRowid));
      }
    }

    if (hasTable("questionnaire_responses") && Array.isArray(qData.responses)) {
      for (const qr of qData.responses) {
        const tForm = formMap.get(Number(qr.form_id));
        const tUser = qr.user_id ? userMap.get(Number(qr.user_id)) || null : null;
        if (tForm) {
          db.prepare(
            `INSERT INTO questionnaire_responses (
              form_id, user_id, context_type, context_id, answers_json, created_at, pseudonym, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            tForm,
            tUser,
            qr.context_type,
            remapContextId(qr),
            qr.answers_json,
            qr.created_at || iso(),
            qr.pseudonym,
            qr.updated_at || iso(),
          );
        }
      }
    }

    // 15. Research Events, Consents, Controls
    if (hasTable("research_events") && Array.isArray(rData.events)) {
      for (const re of rData.events) {
        const tStudy = studyMap.get(Number(re.study_id));
        const tUser = re.user_id ? userMap.get(Number(re.user_id)) || null : null;
        if (tStudy) {
          db.prepare(
            `INSERT INTO research_events (study_id, user_id, event_type, context_type, context_id, data_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            tStudy,
            tUser,
            re.event_type,
            re.context_type,
            remapContextId(re),
            re.data_json,
            re.created_at || iso(),
          );
        }
      }
    }

    if (hasTable("research_consents") && Array.isArray(rData.consents)) {
      for (const rc of rData.consents) {
        const tStudy = studyMap.get(Number(rc.study_id));
        const tUser = rc.user_id ? userMap.get(Number(rc.user_id)) || null : null;
        if (tStudy) {
          db.prepare(
            `INSERT INTO research_consents (
              study_id, user_id, pseudonym, mode, status, consent_text_hash,
              protocol_version, recorded_by, note, granted_at, withdrawn_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            tStudy,
            tUser,
            rc.pseudonym,
            rc.mode,
            rc.status,
            rc.consent_text_hash,
            rc.protocol_version,
            rc.recorded_by ? userMap.get(Number(rc.recorded_by)) || null : null,
            rc.note,
            rc.granted_at,
            rc.withdrawn_at,
          );
        }
      }
    }

    if (hasTable("research_participation_controls") && Array.isArray(rData.controls)) {
      for (const rpc of rData.controls) {
        const tStudy = studyMap.get(Number(rpc.study_id));
        const tUser = userMap.get(Number(rpc.user_id));
        if (tStudy && tUser) {
          db.prepare(
            `INSERT OR REPLACE INTO research_participation_controls (study_id, user_id, blocked, recorded_by, note, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            tStudy,
            tUser,
            rpc.blocked,
            rpc.recorded_by ? userMap.get(Number(rpc.recorded_by)) || 1 : 1,
            rpc.note || "",
            rpc.updated_at || iso(),
          );
        }
      }
    }

    // 16. VP Sessions & Events
    const vpData = data.vp_sessions || {};
    if (hasTable("vp_sessions") && Array.isArray(vpData.sessions)) {
      for (const s of vpData.sessions) {
        const srcId = Number(s.id);
        const tUser = userMap.get(Number(s.user_id));
        const tCase = caseMap.get(Number(s.case_id));
        const tClass = s.class_id ? classMap.get(Number(s.class_id)) || null : null;
        const tExam = s.exam_id ? examMap.get(Number(s.exam_id)) || null : null;
        const tStudy = s.study_id ? studyMap.get(Number(s.study_id)) || null : null;

        if (tUser && tCase) {
          let encounterJson = null;
          if (s.encounter_snapshot_json) {
            const pinned = readEncounter(s);
            const target = db.prepare("SELECT public_code,university_id FROM cases WHERE id=?").get(tCase);
            const checkId = checkMap.get(Number(pinned.caseData.checklist_id)) || null;
            pinned.caseData = { ...remapMedia(pinned.caseData), id: tCase, checklist_id: checkId, public_code: target.public_code, university_id: target.university_id };
            pinned.checklist = { ...pinned.checklist, id: checkId };
            encounterJson = sealEncounter(pinned);
          }
          const insSess = db
            .prepare(
              `INSERT INTO vp_sessions (
                user_id, case_id, class_id, exam_id, study_id, logging_enabled,
                started_at, started_ms, finished_at, attempt_id, duration_sec,
                event_count, lang, start_request_id, reference_snapshot_json, encounter_snapshot_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              tUser,
              tCase,
              tClass,
              tExam,
              tStudy,
              s.logging_enabled ?? 1,
              s.started_at,
              s.started_ms,
              s.finished_at,
              s.attempt_id != null ? attemptMap.get(Number(s.attempt_id)) : null,
              s.duration_sec,
              s.event_count,
              s.lang,
              s.start_request_id,
              s.reference_snapshot_json,
              encounterJson,
            );
          sessionMap.set(srcId, Number(insSess.lastInsertRowid));
        }
      }
    }

    if (hasTable("vp_session_events") && Array.isArray(vpData.events)) {
      for (const se of vpData.events) {
        const tSession = sessionMap.get(Number(se.session_id));
        if (tSession) {
          db.prepare(
            `INSERT INTO vp_session_events (session_id, seq, at_ms, kind, payload_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            tSession,
            se.seq,
            se.at_ms,
            se.kind,
            se.payload_json,
            se.created_at || iso(),
          );
        }
      }
    }

    // Never overwrite existing destination media. An identical file can be
    // reused; a content collision aborts before the database commit.
    for (const sm of stagedMedia) {
      const finalDest = path.join(destDirs.media, safeFileName(sm.name));
      if (fs.existsSync(finalDest)) {
        if (!fs.lstatSync(finalDest).isFile() || !fs.readFileSync(finalDest).equals(fs.readFileSync(sm.path))) throw Error("media_file_conflict");
        continue;
      }
      const fd = fs.openSync(finalDest, "wx", 0o600);
      createdMedia.push(finalDest);
      try { fs.copyFileSync(sm.path, finalDest); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
    }

    return {
      ok: true,
      university_id: targetUniId,
      namespace: targetNs,
      counts: {
        identities: userMap.size,
        references: refMap.size,
        policies: policyMap.size,
        checklists: checkMap.size,
        cases: caseMap.size,
        flashcards: cardMap.size,
        classes: classMap.size,
        exams: examMap.size,
        media: stagedMedia.length,
      },
    };
    });
  } catch (err) {
    for (const file of createdMedia.reverse()) {
      try { fs.unlinkSync(file); } catch { /* report original failure; never delete pre-existing files */ }
    }
    for (const dir of createdDirectories.reverse()) {
      try { fs.rmdirSync(dir); } catch { /* preserve non-empty directories */ }
    }
    throw err;
  } finally {
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch { /* best effort staging cleanup */ }
  }
}

/* Learning Path Importer */
export function importLearningBundle(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || "");
  const files = bundleFileMap(readPortableZip(buffer));
  const manifestBuf = files.get("manifest.json");
  if (!manifestBuf) throw Error("manifest_missing");

  const manifest = parseJson(manifestBuf, "manifest");
  if (manifest.schema !== "medschool.learning-package.v1") {
    throw Error("learning_schema_invalid");
  }

  const topicsBuf = files.get("learning/topics.json");
  const nodesBuf = files.get("learning/path-nodes.json");
  if (!topicsBuf || !nodesBuf) throw Error("learning_payload_missing");

  const topics = parseJson(topicsBuf, "topics");
  const nodes = parseJson(nodesBuf, "path-nodes");
  asArray(topics, "topics");
  asArray(nodes, "nodes");

  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    const topicMap = new Map();
    for (const t of topics) {
      const srcId = Number(t.id);
      let existing = db.prepare("SELECT id FROM topics WHERE slug=?").get(t.slug);
      if (existing) {
        topicMap.set(srcId, existing.id);
      } else {
        const insT = db
          .prepare(
            `INSERT INTO topics (slug, name_fa, name_en, parent, budget, color, icon, ord, active, emoji, program)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            t.slug,
            t.name_fa,
            t.name_en,
            t.parent,
            t.budget,
            t.color,
            t.icon,
            t.ord,
            t.active ?? 1,
            t.emoji,
            t.program,
          );
        topicMap.set(srcId, Number(insT.lastInsertRowid));
      }
    }

    let nodeCount = 0;
    for (const n of nodes) {
      const targetTopicId = topicMap.get(Number(n.topic_id));
      if (targetTopicId) {
        db.prepare(
          `INSERT INTO path_nodes (topic_id, title_fa, title_en, ord, kind, card_ids, subtitle_fa, subtitle_en, curated, premium, xp_reward, active, emoji)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          targetTopicId,
          n.title_fa,
          n.title_en,
          n.ord,
          n.kind,
          n.card_ids || "[]",
          n.subtitle_fa,
          n.subtitle_en,
          n.curated ?? 1,
          n.premium ?? 0,
          n.xp_reward ?? 10,
          n.active ?? 1,
          n.emoji,
        );
        nodeCount++;
      }
    }

    db.exec("COMMIT;");
    return { ok: true, topics_imported: topicMap.size, nodes_imported: nodeCount };
  } catch (e) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // ignore
    }
    throw e;
  }
}

function uploadBuffer(req) {
  const f = req.file;
  if (f?.buffer) return f.buffer;
  if (Buffer.isBuffer(req.body?.bundle)) return req.body.bundle;
  if (typeof req.body?.bundle_base64 === "string")
    return Buffer.from(req.body.bundle_base64, "base64");
  throw Error("bundle_file_required");
}

export function createPortableRouter({ selectedUniversity }) {
  const r = Router();
  const bundleUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BUNDLE, files: 1 },
  });

  r.get(
    "/validate",
    authRequired,
    requireRole("admin", "teacher"),
    requirePerm("uni.content", "learn.data"),
    (req, res) =>
      res.json({
        schema: "medschool.university-portable.v2",
        restorable: true,
        import_enabled: true,
        roots: ["academic/<university-namespace>", "learning"],
        max_bytes: MAX_BUNDLE,
        notes_fa:
          "این بسته شامل ساختار کامل، مراجع مصوب، سوابق و رسانه‌های دانشگاه است و قابلیت بازیابی کامل دارد.",
      }),
  );

  r.post(
    "/export",
    authRequired,
    requireRole("admin", "teacher"),
    requirePerm("uni.content", "learn.data"),
    (req, res) => {
      const uni = selectedUniversity(req);
      if (!uni)
        return res.status(403).json({ error: "university_context_required" });
      try {
        // Keep the legacy preview default; full backups must be explicit.
        const out = createUniversityBundle(uni, { full: req.body?.full === true });
        const dirs = namespaceDirs(out.namespace);
        const file = `${safeFileName(out.namespace)}-${out.manifest.created_at.replace(/[:.]/g, "-")}.zip`;
        const tmp = path.join(dirs.exports, `.${file}.tmp`);
        fs.writeFileSync(tmp, out.buffer, { mode: 0o600 });
        fs.renameSync(tmp, path.join(dirs.exports, file));

        audit(req, "academic.portable.export", `university:${uni.id}`, {
          namespace: out.namespace,
          bundle_id: out.manifest.bundle_id,
          sha256: digest(out.buffer),
        });

        res
          .set({
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${file}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          })
          .send(out.buffer);
      } catch (e) {
        res
          .status(422)
          .json({ error: "portable_export_failed", detail: e.message });
      }
    },
  );

  r.post(
    "/validate",
    authRequired,
    requireRole("admin", "teacher"),
    requirePerm("uni.content", "learn.data"),
    bundleUpload.single("bundle"),
    async (req, res) => {
      try {
        const v = validateUniversityBundle(uploadBuffer(req));
        res.json({
          ok: true,
          restorable: v.restorable,
          manifest: v.manifest,
          warnings: v.warnings,
          summary: {
            identities: v.data.identities.length,
            cases: v.data.cases.length,
            flashcards: v.data.flashcards.length,
            classes: v.data.classes.length,
            exams: v.data.exams.length,
            references: v.data.references.length,
            policies: v.data.policies.length,
            media: v.mediaEntries.length,
          },
        });
      } catch (e) {
        res.status(422).json({
          ok: false,
          error: "portable_bundle_invalid",
          detail: e.message,
        });
      }
    },
  );

  r.post(
    "/import",
    authRequired,
    requireRole("admin"),
    bundleUpload.single("bundle"),
    async (req, res) => {
      let buf;
      try {
        buf = uploadBuffer(req);
      } catch (ue) {
        // When no file or invalid payload sent, check if this is a preview or missing bundle
        return res.status(501).json({
          error: "incomplete_portable_format_import_disabled",
          message_fa: "این قالب هنوز پشتیبان کامل نیست. ورود داده تا ارسال بسته معتبر کامل v2 مسدود است.",
          databaseChanged: false,
        });
      }

      try {
        const targetUniId = req.body?.target_university_id
          ? Number(req.body.target_university_id)
          : null;
        const result = await importUniversityBundle(buf, {
          target_university_id: targetUniId,
        });

        audit(req, "academic.portable.import", `university:${result.university_id}`, {
          namespace: result.namespace,
          counts: result.counts,
        });

        res.json({
          ok: true,
          message_fa: "بسته دانشگاهی با موفقیت وارد و نگاشت گردید.",
          university_id: result.university_id,
          namespace: result.namespace,
          counts: result.counts,
        });
      } catch (e) {
        res.status(e.status || 422).json({
          ok: false,
          error: e.message || "portable_import_failed",
          databaseChanged: false,
        });
      }
    },
  );

  /* Learning domain endpoints */
  r.post(
    "/learning/export",
    authRequired,
    requireRole("admin"),
    (req, res) => {
      try {
        const out = createLearningBundle();
        const file = `learning-path-${out.manifest.created_at.replace(/[:.]/g, "-")}.zip`;
        audit(req, "learning.portable.export", "domain:learning", {
          bundle_id: out.manifest.bundle_id,
          sha256: digest(out.buffer),
        });

        res
          .set({
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${file}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          })
          .send(out.buffer);
      } catch (e) {
        res.status(422).json({ error: "learning_export_failed", detail: e.message });
      }
    },
  );

  r.post(
    "/learning/import",
    authRequired,
    requireRole("admin"),
    bundleUpload.single("bundle"),
    async (req, res) => {
      try {
        let buf;
        try {
          buf = uploadBuffer(req);
        } catch (ue) {
          return res.status(400).json({ error: "bundle_file_required", databaseChanged: false });
        }
        const result = importLearningBundle(buf);
        audit(req, "learning.portable.import", "domain:learning", result);
        res.json({
          ok: true,
          message_fa: "مسیر یادگیری با موفقیت وارد شد.",
          counts: result,
        });
      } catch (e) {
        res.status(422).json({
          ok: false,
          error: e.message || "learning_import_failed",
        });
      }
    },
  );

  return r;
}
