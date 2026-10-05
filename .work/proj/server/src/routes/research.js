import express from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import {
  CONSENT_MODES, consentStatus, statusForStudy, grantOnlineConsent, recordOfflineConsent,
  consentRoster, parseModes, isStaffRole, studyContextForCase,
  studentLinkedToStudy, studentBelongsToClass, studentBelongsToExam,
} from "../lib/consent.js";

const r = express.Router();
const admin = [authRequired, requireRole("admin", "teacher", "content_manager")];
const currentUniversityId = (user) => db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
function teacherOwnsStudentRow(user, universityId, role) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  if (role && role !== "student") return false;
  const uni = currentUniversityId(user);
  return uni != null && (Number(universityId) || 1) === uni;
}
function canManageStudy(user, study) {
  if (!study) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const uni = currentUniversityId(user) || -1;
  const foreignClass = db.prepare("SELECT 1 FROM classes WHERE study_id=? AND COALESCE(university_id,1)!=?").get(study.id, uni);
  const foreignExam = db.prepare("SELECT 1 FROM exams WHERE study_id=? AND COALESCE(university_id,1)!=?").get(study.id, uni);
  if (foreignClass || foreignExam) return false;
  const creator = db.prepare("SELECT id, university_id, role FROM users WHERE id=?").get(study.created_by);
  if (!creator) return study.created_by === user.id;
  if (creator.role === "admin") return false;
  return (creator.university_id || 1) === uni;
}
const parse = (x, fb) => { try { return JSON.parse(x || ""); } catch { return fb; } };
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const normaliseModes = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim().toLowerCase())
  .filter((x) => CONSENT_MODES.includes(x)).join(",") || "online";
const cleanStudy = (s) => s && ({
  ...s, active: !!s.active, consent_required: !!s.consent_required, consent_admin_managed: s.consent_admin_managed !== 0,
  anonymize: !!s.anonymize, consent_modes: parseModes(s.consent_modes),
});

r.get("/studies", ...admin, (req, res) => {
  let rows = db.prepare("SELECT * FROM research_studies ORDER BY active DESC,id DESC").all();
  if (req.user.role === "teacher") rows = rows.filter((s) => canManageStudy(req.user, s));
  else if (req.user.role !== "admin") rows = [];
  res.json({ studies: rows.map(cleanStudy) });
});

r.post("/studies", ...admin, (req, res) => {
  if (req.user.role === "content_manager") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  const b = req.body || {};
  if (b.consent_admin_managed === false && req.user.role !== "admin") return res.status(403).json({error:"admin_only_policy"});
  const info = db.prepare(`INSERT INTO research_studies
    (title_fa,title_en,description_fa,description_en,domain,active,consent_required,created_by,
     ethics_code,protocol_version,consent_text_fa,consent_text_en,consent_modes,anonymize,consent_admin_managed)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.title_fa || "", b.title_en || "", b.description_fa || "", b.description_en || "",
    b.domain || "general", b.active ? 1 : 0, b.consent_required === false ? 0 : 1, req.user.id,
    clip(b.ethics_code, 80), clip(b.protocol_version, 40),
    clip(b.consent_text_fa, 8000), clip(b.consent_text_en, 8000),
    normaliseModes(b.consent_modes ?? "online,paper,verbal"), b.anonymize ? 1 : 0, b.consent_admin_managed === false ? 0 : 1
  );
  audit(req, "research.study_create", "study", { id: info.lastInsertRowid, consentRequired: b.consent_required !== false });
  persistNow();
  res.json(cleanStudy(db.prepare("SELECT * FROM research_studies WHERE id=?").get(info.lastInsertRowid)));
});

// Full admin control: edit or activate/deactivate a study without deleting data.
r.put("/studies/:id", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const old = db.prepare("SELECT * FROM research_studies WHERE id=?").get(id);
  if (!old) return res.status(404).json({ error: "not_found" });
  if (!canManageStudy(req.user, old)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  const b = req.body || {};
  if (b.consent_admin_managed !== undefined && !!b.consent_admin_managed !== !!old.consent_admin_managed && req.user.role !== "admin") return res.status(403).json({error:"admin_only_policy"});
  db.prepare(`UPDATE research_studies SET
    title_fa=?, title_en=?, description_fa=?, description_en=?, domain=?, active=?, consent_required=?,
    ethics_code=?, protocol_version=?, consent_text_fa=?, consent_text_en=?, consent_modes=?, anonymize=?,
    consent_admin_managed=?, updated_at=datetime('now')
    WHERE id=?`).run(
    b.title_fa ?? old.title_fa ?? "", b.title_en ?? old.title_en ?? "",
    b.description_fa ?? old.description_fa ?? "", b.description_en ?? old.description_en ?? "",
    b.domain ?? old.domain ?? "general",
    b.active === undefined ? old.active : (b.active ? 1 : 0),
    b.consent_required === undefined ? old.consent_required : (b.consent_required ? 1 : 0),
    b.ethics_code === undefined ? (old.ethics_code || "") : clip(b.ethics_code, 80),
    b.protocol_version === undefined ? (old.protocol_version || "") : clip(b.protocol_version, 40),
    b.consent_text_fa === undefined ? (old.consent_text_fa || "") : clip(b.consent_text_fa, 8000),
    b.consent_text_en === undefined ? (old.consent_text_en || "") : clip(b.consent_text_en, 8000),
    b.consent_modes === undefined ? (old.consent_modes || "online") : normaliseModes(b.consent_modes),
    b.anonymize === undefined ? (old.anonymize || 0) : (b.anonymize ? 1 : 0),
    b.consent_admin_managed === undefined ? old.consent_admin_managed : (b.consent_admin_managed ? 1 : 0),
    id
  );
  audit(req, "research.study_update", "study", {
    id, active: b.active === undefined ? old.active : !!b.active,
    consentRequired: b.consent_required === undefined ? old.consent_required : !!b.consent_required,
  });
  persistNow();
  res.json(cleanStudy(db.prepare("SELECT * FROM research_studies WHERE id=?").get(id)));
});

r.get("/events", ...admin, (req, res) => {
  let rows = [];
  if (req.user.role === "teacher") {
    rows = db.prepare(`SELECT e.*, s.title_fa, s.title_en, COALESCE(u.name_fa,u.name_en,u.username) AS user_name, u.role AS user_role
        FROM research_events e
        JOIN research_studies s ON s.id=e.study_id
        JOIN users u ON u.id=e.user_id
        WHERE e.study_id IS NOT NULL AND u.university_id=?
        ORDER BY e.id DESC LIMIT 1000`).all(currentUniversityId(req.user) || -1);
  } else if (req.user.role === "admin") {
    rows = db.prepare(`SELECT e.*, s.title_fa, s.title_en, COALESCE(u.name_fa,u.name_en,u.username) AS user_name, u.role AS user_role
        FROM research_events e
        JOIN research_studies s ON s.id=e.study_id
        LEFT JOIN users u ON u.id=e.user_id
        WHERE e.study_id IS NOT NULL
        ORDER BY e.id DESC LIMIT 1000`).all();
  }
  res.json({ events: rows.map((x) => ({ ...x, data: parse(x.data_json, {}) })) });
});
r.delete("/events/:id", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const row = db.prepare(`SELECT e.id, u.university_id, u.role
      FROM research_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.id=?`).get(id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!teacherOwnsStudentRow(req.user, row.university_id, row.role)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  db.prepare("DELETE FROM research_events WHERE id=?").run(id);
  persistNow();
  res.json({ ok: true });
});
r.delete("/studies/:id", ...admin, (req, res) => {
  const id = Number(req.params.id || 0);
  const old = db.prepare("SELECT * FROM research_studies WHERE id=?").get(id);
  if (!old) return res.status(404).json({ error: "not_found" });
  if (!canManageStudy(req.user, old)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  db.prepare("DELETE FROM research_events WHERE study_id=?").run(id);
  db.prepare("DELETE FROM research_consents WHERE study_id=?").run(id);
  db.prepare("UPDATE classes SET study_id=NULL WHERE study_id=?").run(id);
  db.prepare("UPDATE exams SET study_id=NULL WHERE study_id=?").run(id);
  db.prepare("DELETE FROM research_studies WHERE id=?").run(id);
  persistNow();
  res.json({ ok: true });
});

/* Whitelists for the public event-ingest endpoint. Without them any logged-in
   user could write arbitrary rows into the research dataset (any study id, any
   event name, unbounded payload) — which is both an abuse vector and a direct
   threat to the integrity of the study's data. */
const EVENT_TYPES = new Set([
  "consent_viewed", "consent_granted", "consent_withdrawn",
  "session_started", "session_finished", "case_opened",
  "flashcard_finished",
  "feedback_submitted", "questionnaire_submitted",
  "note", "custom",
]);
const CONTEXT_TYPES = new Set(["general", "class", "exam", "case", "study"]);
const MAX_DATA_BYTES = 8 * 1024;          // a payload bigger than this is never a legit event
const MAX_STRING_FIELD = 200;

r.post("/event", authRequired, (req, res) => {
  const b = req.body || {};

  // 1) A named study must exist AND be active — no writing into inactive or
  //    non-existent studies.
  let studyId = null;
  if (b.study_id != null && b.study_id !== "") {
    studyId = Number(b.study_id) || null;
    if (!studyId) return res.status(400).json({ error: "bad_study_id" });
    const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(studyId);
    if (!st) return res.status(404).json({ error: "study_not_found" });
    if (!st.active) return res.status(403).json({ error: "study_inactive" });
    if (req.user.role === "teacher" && !canManageStudy(req.user, st)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
    if (!isStaffRole(req.user.role)) {
      const linked = studentLinkedToStudy(req.user, studyId);
      if (!linked) {
        // A study that collects explicit consent may only receive events from
        // its enrolled participants (class/exam link) — the same rule the
        // consent endpoints enforce. A consent-OPTIONAL study (e.g. an
        // institution-wide satisfaction instrument) is open to students of the
        // creator's university without an enrolment link.
        if (st.consent_required) {
          return res.status(403).json({ error: "not_in_study", stage: "access" });
        }
        // Only university students participate; competitive-track learners and
        // content managers never feed research data.
        if (req.user.role !== "student") {
          return res.status(403).json({ error: "university_only", stage: "access" });
        }
        const creator = db.prepare("SELECT university_id, role FROM users WHERE id=?").get(st.created_by);
        const me = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id);
        const sameUniversity = !creator || creator.role === "admin"
          || (creator.university_id || 1) === (me?.university_id || 1);
        if (!sameUniversity) {
          return res.status(403).json({ error: "not_in_study", stage: "access" });
        }
      }
    }
  }

  // 2) Known event/context vocabulary only.
  const eventType = String(b.event_type || "custom").slice(0, MAX_STRING_FIELD);
  if (!EVENT_TYPES.has(eventType)) return res.status(400).json({ error: "unknown_event_type" });
  const rawContext = b.context_type == null || b.context_type === "" ? null : String(b.context_type).slice(0, MAX_STRING_FIELD);
  if (rawContext && !CONTEXT_TYPES.has(rawContext)) return res.status(400).json({ error: "unknown_context_type" });
  const contextId = Number(b.context_id) || null;

  // 3) Payload size cap (a research event is a marker, not a document).
  const data = (b.data && typeof b.data === "object") ? b.data : {};
  let dataJson;
  try { dataJson = JSON.stringify(data); } catch { return res.status(400).json({ error: "bad_data" }); }
  if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_BYTES) return res.status(413).json({ error: "data_too_large" });

  // A research event without a live study pollutes the dataset (and lets a
  // learner write rows that are not university-opt-in). Require a valid id.
  if (!studyId) return res.status(400).json({ error: "bad_study_id", stage: "access" });

  /* 4) A study that requires consent cannot receive a participant's data
        until that participant has actually consented. This was the gap:
        `consent_required` was stored and displayed but never enforced. */
  if (studyId) {
    const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(studyId);
    const status = statusForStudy(req.user, st);
    if (!status.granted) return res.status(403).json({ error: status.reason === "research_paused" ? "research_paused" : "consent_required" });
  }

  db.prepare(`INSERT INTO research_events
    (study_id,user_id,event_type,context_type,context_id,data_json) VALUES (?,?,?,?,?,?)`).run(
    studyId, req.user.id, eventType, rawContext, contextId, dataJson
  );
  persistNow();
  res.json({ ok: true });
});

/* ================================================================
   Consent endpoints
   ================================================================ */

/* What the participant must see before taking part. Reachable by any logged-in
   user: a student needs to read it before they can agree to it. */
r.get("/consent/status", authRequired, (req, res) => {
  try {
    const { classId, examId, studyId, caseId } = req.query;
    if (studyId) {
      if (req.user.role === "learner") {
        return res.status(403).json({ error: "university_only", stage: "consent" });
      }
      const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(Number(studyId) || 0);
      if (!st) return res.status(404).json({ error: "study_not_found", stage: "consent" });
      if (req.user.role === "teacher" && !canManageStudy(req.user, st)) {
        return res.status(403).json({ error: "wrong_university", stage: "consent" });
      }
      if (!isStaffRole(req.user.role) && !studentLinkedToStudy(req.user, st.id)) {
        return res.status(403).json({ error: "not_in_study", stage: "consent" });
      }
      return res.json(statusForStudy(req.user, st));
    }
    let cid = Number(classId) || null;
    let eid = Number(examId) || null;
    if (!cid && !eid && caseId) {
      const ctx = studyContextForCase(req.user, caseId);
      cid = ctx.classId || null;
      eid = ctx.examId || null;
    }
    if (req.user.role === "learner" && (studyId || cid || eid)) {
      return res.status(403).json({ error: "university_only", stage: "consent" });
    }
    if (req.user.role === "teacher") {
      if (cid) {
        const cl = db.prepare("SELECT university_id FROM classes WHERE id=?").get(cid);
        if (!cl || cl.university_id !== currentUniversityId(req.user)) {
          return res.status(403).json({ error: "wrong_university", stage: "consent" });
        }
      }
      if (eid) {
        const ex = db.prepare("SELECT university_id FROM exams WHERE id=?").get(eid);
        if (!ex || ex.university_id !== currentUniversityId(req.user)) {
          return res.status(403).json({ error: "wrong_university", stage: "consent" });
        }
      }
    }
    if (!isStaffRole(req.user.role)) {
      if (cid && !studentBelongsToClass(req.user.id, cid)) {
        return res.status(403).json({ error: "not enrolled", stage: "consent" });
      }
      if (eid && !studentBelongsToExam(req.user.id, eid)) {
        return res.status(403).json({ error: "not assigned", stage: "consent" });
      }
    }
    res.json(consentStatus(req.user, { classId: cid, examId: eid }));
  } catch (e) {
    res.status(500).json({ error: "consent_status_failed", stage: "consent", message: String(e.message || e).slice(0, 200) });
  }
});

/* The participant agrees, in the app, to the wording currently on file. */
r.post("/consent", authRequired, (req, res) => {
  try {
  const studyId = Number(req.body?.study_id || 0);
  if (!studyId) return res.status(400).json({ error: "bad_study_id", stage: "consent" });
  if (req.user.role === "learner") {
    return res.status(403).json({ error: "university_only", stage: "consent" });
  }
  if (req.user.role === "teacher") {
    const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(studyId);
    if (st && !canManageStudy(req.user, st)) {
      return res.status(403).json({ error: "wrong_university", stage: "consent" });
    }
  }
  const out = grantOnlineConsent(req.user, studyId);
  if (out.error === "not_in_study") return res.status(403).json({ error: out.error, stage: "consent" });
  if (out.error) return res.status(409).json({ error: out.error, stage: "consent" });
  db.prepare("INSERT INTO research_events (study_id,user_id,event_type,context_type,data_json) VALUES (?,?,?,?,?)")
    .run(studyId, req.user.id, "consent_granted", "study", JSON.stringify({ mode: "online", hash: out.hash }));
  audit(req, "research.consent_granted", "study", { studyId, mode: "online" });
  res.json({ ok: true, status: "granted" });
  } catch (e) {
    res.status(500).json({ error: "consent_failed", stage: "consent", message: String(e.message || e).slice(0, 200) });
  }
});

/* The participant withdraws. They must be able to do this themselves. */
r.post("/consent/withdraw", authRequired, (req, res) => {
  try {
  const studyId = Number(req.body?.study_id || 0);
  if (!studyId) return res.status(400).json({ error: "bad_study_id", stage: "consent" });
  const study = db.prepare("SELECT * FROM research_studies WHERE id=?").get(studyId);
  if (!study) return res.status(404).json({error:"study_not_found"});
  if (!studentLinkedToStudy(req.user, studyId)) return res.status(403).json({error:"not_in_study"});
  db.prepare("INSERT INTO research_events(study_id,user_id,event_type,context_type,data_json) VALUES (?,?, 'withdrawal_requested','study',?)")
    .run(studyId, req.user.id, JSON.stringify({note:clip(req.body?.note,500)}));
  audit(req,"research.withdrawal_requested","study",{studyId});
  persistNow({throwOnError:true});
  return res.status(202).json({ok:true,status:"pending_admin",collectionPaused:false});
  } catch (e) {
    res.status(500).json({ error: "consent_withdraw_failed", stage: "consent", message: String(e.message || e).slice(0, 200) });
  }
});

/* A researcher records a consent collected OFFLINE (paper or verbal). The
   researcher's own identity and a note are mandatory, because this row is the
   only evidence that the consent exists. */
r.post("/studies/:id/consents/record", ...admin, (req, res) => {
  if (req.user.role === "content_manager") {
    return res.status(403).json({ error: "university_only", stage: "access" });
  }
  const b = req.body || {};
  const sid = Number(req.params.id || 0);
  const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(sid);
  if (!st) return res.status(404).json({ error: "study_not_found" });
  if (req.user.role === "teacher" && !canManageStudy(req.user, st)) {
    return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  if (req.user.role === "teacher" && b.user_id) {
    const target = db.prepare("SELECT university_id, role FROM users WHERE id=?").get(b.user_id);
    if (!target || !teacherOwnsStudentRow(req.user, target.university_id, target.role)) {
      return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
  }
  const out = recordOfflineConsent({
    studyId: sid, userId: b.user_id, pseudonym: b.pseudonym,
    mode: b.mode, recordedBy: req.user.id, note: b.note,
  });
  if (out.error) return res.status(out.status || 400).json({ error: out.error });
  if (Number(b.user_id)) {
    db.prepare("INSERT INTO research_events (study_id,user_id,event_type,context_type,data_json) VALUES (?,?,?,?,?)")
      .run(sid, Number(b.user_id), "consent_granted", "study",
           JSON.stringify({ mode: out.mode, recordedBy: req.user.id }));
  }
  audit(req, "research.consent_recorded", "study", { studyId: sid, mode: out.mode, userId: Number(b.user_id) || null });
  res.json({ ok: true, ...out });
});

r.post("/studies/:id/participation", authRequired, requireRole("admin"), (req,res) => {
  const sid=Number(req.params.id), uid=Number(req.body?.user_id), blocked=req.body?.blocked;
  const note=clip(req.body?.note,500).trim();
  const study=db.prepare("SELECT * FROM research_studies WHERE id=?").get(sid);
  if (!study) return res.status(404).json({error:"study_not_found"});
  if (typeof blocked !== "boolean" || !note) return res.status(400).json({error:"decision_and_note_required"});
  const target=db.prepare("SELECT * FROM users WHERE id=?").get(uid);
  if (!target || target.role !== "student" || !studentLinkedToStudy(target,sid)) return res.status(400).json({error:"participant_not_in_study"});
  try {
    db.transaction(()=>{
      db.prepare(`INSERT INTO research_participation_controls(study_id,user_id,blocked,recorded_by,note)
        VALUES (?,?,?,?,?) ON CONFLICT(study_id,user_id) DO UPDATE SET blocked=excluded.blocked,
        recorded_by=excluded.recorded_by,note=excluded.note,updated_at=datetime('now')`).run(sid,uid,blocked?1:0,req.user.id,note);
      db.prepare("INSERT INTO research_events(study_id,user_id,event_type,context_type,data_json) VALUES (?,?,?,'study',?)")
        .run(sid,uid,blocked?"participation_paused":"participation_resumed",JSON.stringify({recordedBy:req.user.id,note}));
    })();
    persistNow({throwOnError:true});
    res.json({ok:true,blocked});
  } catch {res.status(500).json({error:"participation_save_failed"});}
});

function refuseStudyRoster(req, res) {
  if (req.user.role === "content_manager") {
    res.status(403).json({ error: "university_only", stage: "access" });
    return true;
  }
  const st = db.prepare("SELECT * FROM research_studies WHERE id=?").get(Number(req.params.id) || 0);
  if (!st) {
    res.status(404).json({ error: "study_not_found" });
    return true;
  }
  if (!canManageStudy(req.user, st)) {
    res.status(403).json({ error: "wrong_university", stage: "access" });
    return true;
  }
  return false;
}

/* The roster the ethics committee will ask for. */
r.get("/studies/:id/consents", ...admin, (req, res) => {
  if (refuseStudyRoster(req, res)) return;
  const uni = req.user.role === "teacher" ? (currentUniversityId(req.user) || -1)
    : req.user.role === "admin" ? null : -1;
  const out = consentRoster(req.params.id, { anonymize: req.query.anonymize === "1", universityId: uni });
  if (!out) return res.status(404).json({ error: "study_not_found" });
  if (req.user.role === "admin") out.participationControls = db.prepare("SELECT user_id,blocked,note,recorded_by,updated_at FROM research_participation_controls WHERE study_id=?").all(Number(req.params.id));
  res.json(out);
});

/* CSV export of the roster — what actually gets attached to a report. */
r.get("/studies/:id/consents.csv", ...admin, (req, res) => {
  if (refuseStudyRoster(req, res)) return;
  const uni = req.user.role === "teacher" ? (currentUniversityId(req.user) || -1)
    : req.user.role === "admin" ? null : -1;
  const out = consentRoster(req.params.id, { anonymize: req.query.anonymize === "1", universityId: uni });
  if (!out) return res.status(404).json({ error: "study_not_found" });
  const esc = (v) => { const x = v == null ? "" : String(v); return /[,\n\r"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const header = ["pseudonym", "student_no", "participant", "mode", "status", "protocol_version", "consent_text_hash", "stale", "recorded_by", "note", "granted_at", "withdrawn_at"];
  const lines = [header.join(",")];
  for (const c of out.consents) {
    lines.push([c.pseudonym, c.studentNo, c.participantName, c.mode, c.status, c.protocolVersion,
                c.consentTextHash, c.stale ? "yes" : "no", c.recorder, esc(c.note), c.grantedAt, c.withdrawnAt || ""].map(esc).join(","));
  }
  audit(req, "research.consent_export", "study", { studyId: out.study.id, rows: out.consents.length, anonymized: out.study.anonymized });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="consents-${out.study.id}.csv"`);
  res.send("\uFEFF" + lines.join("\n"));
});

export default r;
