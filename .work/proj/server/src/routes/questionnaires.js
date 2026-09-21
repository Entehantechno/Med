import express from "express";
import { safeFilename } from "../lib/csv.js";
import { scoreOsceChecklist, scoreLikert, aggregateNps, RESEARCH_INSTRUMENTS } from "../data/research-instruments.js";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { pseudonymFor } from "../lib/pseudonym.js";
import { audit } from "../lib/audit.js";

const r = express.Router();
const admin = [authRequired, requireRole("admin", "teacher", "content_manager")];
const currentUniversityId = (user) => db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
function formInUniversity(f, uni) {
  if (f.class_id) {
    const cl = db.prepare("SELECT university_id FROM classes WHERE id=?").get(f.class_id);
    return !!(cl && (cl.university_id || 1) === uni);
  }
  if (f.exam_id) {
    const ex = db.prepare("SELECT university_id FROM exams WHERE id=?").get(f.exam_id);
    return !!(ex && (ex.university_id || 1) === uni);
  }
  const creator = db.prepare("SELECT university_id, role FROM users WHERE id=?").get(f.created_by);
  if (!creator) return false;
  if (creator.role === "admin") return false;
  return (creator.university_id || 1) === uni;
}
function canManageForm(user, f) {
  if (!f) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  return formInUniversity(f, currentUniversityId(user) || -1);
}
const parse = (x, fb) => { try { return JSON.parse(x || ""); } catch { return fb; } };
const clean = (f) => f && ({ ...f, active: !!f.active, anonymous: !!f.anonymous, require_after_finish: !!f.require_after_finish, questions: parse(f.questions_json, []) });
const nid = (v) => (v === "" || v === null || v === undefined ? null : Number(v) || null);
const scopeOf = (v) => ["general", "class", "exam"].includes(v) ? v : "general";
const questionsOf = (b) => Array.isArray(b.questions) ? b.questions : [];

r.get("/admin/forms", ...admin, (req, res) => {
  let rows = db.prepare("SELECT * FROM questionnaire_forms ORDER BY active DESC,id DESC").all();
  if (req.user.role === "teacher") {
    const uni = currentUniversityId(req.user) || -1;
    rows = rows.filter((f) => formInUniversity(f, uni));
  } else if (req.user.role !== "admin") {
    rows = [];
  }
  res.json({ forms: rows.map(clean) });
});

r.post("/admin/forms", ...admin, (req, res) => {
  if (req.user.role === "content_manager") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  const b = req.body || {};
  if (req.user.role === "teacher") {
    const fake = { class_id: nid(b.class_id), exam_id: nid(b.exam_id), created_by: req.user.id };
    if ((fake.class_id || fake.exam_id) && !formInUniversity(fake, currentUniversityId(req.user) || -1)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
  }
  const qs = questionsOf(b);
  const info = db.prepare(`INSERT INTO questionnaire_forms
    (title_fa,title_en,description_fa,description_en,scope,class_id,exam_id,questions_json,active,require_after_finish,anonymous,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.title_fa || "", b.title_en || "", b.description_fa || "", b.description_en || "",
    scopeOf(b.scope), nid(b.class_id), nid(b.exam_id), JSON.stringify(qs),
    b.active === false ? 0 : 1, b.require_after_finish === false ? 0 : 1, b.anonymous === false ? 0 : 1, req.user.id
  );
  persistNow();
  res.json(clean(db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(info.lastInsertRowid)));
});

// Full admin control: edit/toggle an existing questionnaire without deleting responses.
r.put("/admin/forms/:id", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const old = db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(id);
  if (!old) return res.status(404).json({ error: "not_found" });
  if (!canManageForm(req.user, old)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const b = req.body || {};
  if (req.user.role === "teacher") {
    const fake = {
      class_id: nid(b.class_id !== undefined ? b.class_id : old.class_id),
      exam_id: nid(b.exam_id !== undefined ? b.exam_id : old.exam_id),
      created_by: old.created_by,
    };
    if (!formInUniversity(fake, currentUniversityId(req.user) || -1)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
  }
  db.prepare(`UPDATE questionnaire_forms SET
    title_fa=?, title_en=?, description_fa=?, description_en=?, scope=?, class_id=?, exam_id=?,
    questions_json=?, active=?, require_after_finish=?, anonymous=?, updated_at=datetime('now')
    WHERE id=?`).run(
    b.title_fa ?? old.title_fa ?? "", b.title_en ?? old.title_en ?? "",
    b.description_fa ?? old.description_fa ?? "", b.description_en ?? old.description_en ?? "",
    scopeOf(b.scope ?? old.scope), nid(b.class_id ?? old.class_id), nid(b.exam_id ?? old.exam_id),
    JSON.stringify(Array.isArray(b.questions) ? b.questions : parse(old.questions_json, [])),
    b.active === undefined ? old.active : (b.active ? 1 : 0),
    b.require_after_finish === undefined ? old.require_after_finish : (b.require_after_finish ? 1 : 0),
    b.anonymous === undefined ? old.anonymous : (b.anonymous ? 1 : 0), id
  );
  persistNow();
  res.json(clean(db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(id)));
});

r.get("/prompts", authRequired, (req, res) => {
  const type = req.query.contextType || "general";
  const id = Number(req.query.contextId || 0) || null;
  // Competitive learners never see university instruments (including scope=general).
  if (req.user.role === "learner") {
    if (type === "class" || type === "exam") {
      return res.status(403).json({ error: "university_only", stage: "access" });
    }
    return res.json({ forms: [] });
  }
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "forbidden", stage: "access" });
  }
  if (type === "class" || type === "exam") {
    if (!id) {
      return res.status(403).json({ error: type === "class" ? "not enrolled" : "not assigned", stage: "access" });
    }
    if (type === "class") {
      const mem = db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(id, req.user.id);
      if (!mem) return res.status(403).json({ error: "not enrolled", stage: "access" });
    } else if (type === "exam") {
      const mem = db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(id, req.user.id);
      if (!mem) return res.status(403).json({ error: "not assigned", stage: "access" });
    }
  }
  const col = type === "class" ? "class_id" : type === "exam" ? "exam_id" : "id";
  let rows = db.prepare(`SELECT * FROM questionnaire_forms WHERE active=1 AND (scope='general' OR (scope=? AND (${col}=? OR ${col} IS NULL))) ORDER BY id DESC LIMIT 50`).all(type, id);
  const uni = currentUniversityId(req.user) || -1;
  rows = rows.filter((f) => formInUniversity(f, uni)).slice(0, 5);
  // A form counts as answered when we have a row for this user by id OR by
  // pseudonym — anonymous forms store no user_id, so the id-only lookup used to
  // re-prompt the same student forever.
  const done = new Set([
    ...db.prepare("SELECT form_id FROM questionnaire_responses WHERE user_id=?").all(req.user.id).map((r) => r.form_id),
    ...db.prepare("SELECT form_id FROM questionnaire_responses WHERE pseudonym=?").all(pseudonymFor(req.user.id, "q")).map((r) => r.form_id),
  ]);
  res.json({ forms: rows.map(clean).filter((f) => !done.has(f.id)) });
});

r.post("/:id/responses", authRequired, (req, res) => {
  const id = Number(req.params.id);
  const f = db.prepare("SELECT * FROM questionnaire_forms WHERE id=? AND active=1").get(id);
  if (!f) return res.status(404).json({ error: "not_found" });

  const contextType = String(req.body?.contextType || f.scope || "general");
  const contextId = Number(req.body?.contextId || f.class_id || f.exam_id || 0) || null;
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "forbidden", stage: "access" });
  }
  const classId = contextType === "class" || f.scope === "class" ? (contextId || f.class_id) : null;
  const examId = contextType === "exam" || f.scope === "exam" ? (contextId || f.exam_id) : null;
  if (classId) {
    const mem = db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(classId, req.user.id);
    if (!mem) return res.status(403).json({ error: "not enrolled", stage: "access" });
  }
  if (examId) {
    const mem = db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(examId, req.user.id);
    if (!mem) return res.status(403).json({ error: "not assigned", stage: "access" });
  }
  if (!classId && !examId && !formInUniversity(f, currentUniversityId(req.user) || -1)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }

  /* An anonymous form must not record WHO answered. We still need a stable
     one-way code so (a) the same person cannot submit twice and (b) the
     analyst can pair this row with other rows from the same participant. */
  const pseudo = pseudonymFor(req.user.id, "q");
  const storedUserId = f.anonymous ? null : req.user.id;

  /* Explicit upsert. The table's UNIQUE(form_id,user_id,context_type,context_id)
     cannot deduplicate here: when the form is anonymous user_id is NULL, and in
     SQLite NULLs are distinct in a UNIQUE index — which used to let one student
     insert unlimited "anonymous" responses. */
  const existing = db.prepare(
    `SELECT id FROM questionnaire_responses
      WHERE form_id=? AND pseudonym IS ? AND context_type=? AND context_id IS ?`
  ).get(id, pseudo, contextType, contextId);

  const answers = JSON.stringify(req.body?.answers || {});
  if (existing) {
    db.prepare(`UPDATE questionnaire_responses SET answers_json=?, user_id=?, updated_at=datetime('now') WHERE id=?`)
      .run(answers, storedUserId, existing.id);
  } else {
    db.prepare(`INSERT INTO questionnaire_responses
      (form_id,user_id,pseudonym,context_type,context_id,answers_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`)
      .run(id, storedUserId, pseudo, contextType, contextId, answers);
  }
  persistNow();
  res.json({ ok: true, replaced: !!existing });
});

r.get("/admin/responses", ...admin, (req, res) => {
  // LEFT JOIN users (never INNER): anonymous responses store user_id=NULL and
  // an INNER JOIN silently hid them from the researcher. Tenancy for teachers is
  // enforced per-FORM via canManageForm below, which is independent of the
  // (absent) respondent's university.
  let rows = db.prepare(`SELECT qr.*, q.title_fa, q.title_en, COALESCE(u.name_fa,u.name_en,u.username) AS user_name, u.role AS user_role
      FROM questionnaire_responses qr
      LEFT JOIN questionnaire_forms q ON q.id=qr.form_id
      LEFT JOIN users u ON u.id=qr.user_id
      ORDER BY qr.id DESC LIMIT 1000`).all();
  if (req.user.role === "teacher") {
    rows = rows.filter((x) => canManageForm(req.user, db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(x.form_id)));
  } else if (req.user.role !== "admin") {
    rows = [];
  }
  // Anonymous forms carry no user_id, so the LEFT JOIN already yields no name.
  // `pseudonym` is exposed so the researcher can still group one participant's
  // rows without learning who they are.
  res.json({
    responses: rows.map((x) => ({
      ...x,
      answers: parse(x.answers_json, {}),
      anonymous: x.user_id == null,
      user_name: x.user_id == null ? null : x.user_name,
      user_role: x.user_id == null ? null : x.user_role,
    })),
  });
});

/* ================================================================
   Instrument analysis + de-identified export
   ================================================================ */

const RESP_JOIN = `SELECT qr.*, q.title_fa, q.title_en, q.questions_json, q.template_key, q.anonymous AS form_anonymous,
     u.student_no, COALESCE(u.name_fa,u.name_en,u.username) AS user_name
   FROM questionnaire_responses qr
   LEFT JOIN questionnaire_forms q ON q.id=qr.form_id
   LEFT JOIN users u ON u.id=qr.user_id`;

/* Scored analysis of one instrument. `anonymize=1` (or an anonymous form)
   drops every identifier and keeps only the pseudonym. */
r.get("/admin/forms/:id/analysis", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const form = db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(id);
  if (!form) return res.status(404).json({ error: "not_found" });
  if (!canManageForm(req.user, form)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const items = parse(form.questions_json, []);
  // Access to the FORM as a whole is gated above by canManageForm, so scope by
  // form id only. The old u.university_id predicate excluded ANONYMOUS rows
  // (their user_id, and thus u.*, is NULL) — the researcher then saw an empty
  // dataset for exactly the forms meant to be de-identified.
  const rows = db.prepare(`${RESP_JOIN} WHERE qr.form_id=? ORDER BY qr.id`).all(id);

  const isChecklist = items.length > 0 && items.every((it) => it.type === "check");
  const template = RESEARCH_INSTRUMENTS.find((t) => t.key === form.template_key) || null;

  // Per-item statistics across respondents.
  const perItem = items.map((it) => {
    const vals = rows.map((r) => parse(r.answers_json, {})[it.id]).filter((v) => v != null && v !== "");
    const nums = vals.map(Number).filter((v) => Number.isFinite(v));
    const hit = isChecklist ? vals.filter((v) => v === true || v === 1 || v === "1").length : null;
    return {
      id: it.id, fa: it.fa, en: it.en, nps: !!it.nps,
      answered: vals.length,
      mean: nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null,
      // For the checklist, the pass rate per criterion — that is what the
      // protocol's Table 1 reports.
      passRate: hit == null || !vals.length ? null : Math.round((hit / vals.length) * 100),
    };
  });

  const scored = rows.map((r) => {
    const answers = parse(r.answers_json, {});
    const sc = isChecklist ? scoreOsceChecklist(answers, { items }) : scoreLikert(answers, { items });
    return { r, answers, sc };
  });

  const npsItem = items.find((it) => it.nps);
  const nps = npsItem ? aggregateNps(scored.map((x) => x.sc)) : null;

  const means = scored.map((x) => (isChecklist ? x.sc.outOf10 : x.sc.mean)).filter((v) => Number.isFinite(v));
  const overall = means.length
    ? { n: means.length, mean: Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100,
        min: Math.min(...means), max: Math.max(...means) }
    : { n: 0, mean: null, min: null, max: null };

  const anonymize = req.query.anonymize === "1" || !!form.anonymous;
  audit(req, "questionnaire.analysis", "form", { id, anonymized: anonymize, responses: rows.length });

  res.json({
    form: { id, titleFa: form.title_fa, titleEn: form.title_en, templateKey: form.template_key,
            active: !!form.active, anonymized: anonymize, isChecklist },
    overall, nps,
    perItem,
    responses: scored.map(({ r, sc }) => ({
      id: r.id,
      pseudonym: r.pseudonym || "",
      studentNo: anonymize ? "" : (r.student_no || ""),
      participant: anonymize ? "" : (r.user_name || ""),
      score: isChecklist ? { outOf10: sc.outOf10, raw: sc.raw, maxRaw: sc.maxRaw, answered: sc.answered, total: sc.total }
                         : { mean: sc.mean, answered: sc.answered, total: sc.total },
      npsScore: sc.nps ? sc.nps.score : null,
      submittedAt: r.updated_at || r.created_at,
    })),
    // The protocol wording, so the UI can offer "restore template defaults".
    template: template ? { key: template.key, items: template.items, scale: template.scale || null, max: template.max || null } : null,
  });
});

/* CSV export of one instrument's responses — one row per respondent, plus the
   header carrying every item id. De-identified by default for anonymous forms. */
r.get("/admin/forms/:id/responses.csv", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const form = db.prepare("SELECT * FROM questionnaire_forms WHERE id=?").get(id);
  if (!form) return res.status(404).json({ error: "not_found" });
  if (!canManageForm(req.user, form)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const items = parse(form.questions_json, []);
  // Access to the FORM as a whole is gated above by canManageForm, so scope by
  // form id only. The old u.university_id predicate excluded ANONYMOUS rows
  // (their user_id, and thus u.*, is NULL) — the researcher then saw an empty
  // dataset for exactly the forms meant to be de-identified.
  const rows = db.prepare(`${RESP_JOIN} WHERE qr.form_id=? ORDER BY qr.id`).all(id);
  const anonymize = req.query.anonymize === "1" || !!form.anonymous;

  const esc = (v) => { const x = v == null ? "" : String(v); return /[,\n\r"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const header = ["response_id", ...(anonymize ? ["pseudonym"] : ["pseudonym", "student_no", "participant"]),
                  ...items.map((it) => it.id), "submitted_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const a = parse(r.answers_json, {});
    lines.push([
      r.id, r.pseudonym || "",
      ...(anonymize ? [] : [r.student_no || "", r.user_name || ""]),
      ...items.map((it) => { const v = a[it.id]; return v === true ? 1 : (v === false ? 0 : (v ?? "")); }),
      esc(r.updated_at || r.created_at || ""),
    ].map(esc).join(","));
  }
  audit(req, "questionnaire.export", "form", { id, rows: rows.length, anonymized: anonymize });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(form.template_key, `form-${id}`)}-responses.csv"`);
  res.send("\uFEFF" + lines.join("\n"));
});

/* The protocol instruments as shipped, so the admin can see what an edited
   form has drifted from (or reset it). */
r.get("/admin/templates", ...admin, (req, res) => {
  if (req.user.role === "content_manager") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  res.json({ templates: RESEARCH_INSTRUMENTS.map((t) => ({
    key: t.key, titleFa: t.title_fa, titleEn: t.title_en,
    descriptionFa: t.description_fa, descriptionEn: t.description_en,
    anonymous: !!t.anonymous, scale: t.scale || null, max: t.max || null, items: t.items,
  })) });
});

export default r;
