/* Research consent records are distinct from permission to collect.
   Default: admin-managed, allowing paper/verbal consent outside the website.
   Only an explicit admin participation hold stops collection in this mode.
   Online gating is opt-in per study. Text changes are informational only.
   Existing consent evidence is preserved, never fabricated by a policy switch. */
import { createHash } from "node:crypto";
import { db, persistNow } from "../db.js";
import { pseudonymFor } from "./pseudonym.js";

export const CONSENT_MODES = ["online", "paper", "verbal"];
const MODE_SET = new Set(CONSENT_MODES);

/* Roles that run or supervise a study rather than take part in it. They are not
   research participants, so consent does not gate their QA access. */
const STAFF_ROLES = new Set(["admin", "teacher"]);
export const isStaffRole = (role) => STAFF_ROLES.has(String(role || ""));

export function studentBelongsToClass(userId, classId) {
  const cid = Number(classId) || 0;
  if (!userId || !cid) return false;
  return !!db.prepare(
    `SELECT 1 FROM class_members m JOIN classes c ON c.id=m.class_id
      WHERE m.class_id=? AND m.user_id=? AND c.active=1`
  ).get(cid, userId);
}
export function studentBelongsToExam(userId, examId) {
  const eid = Number(examId) || 0;
  if (!userId || !eid) return false;
  return !!db.prepare(
    `SELECT 1 FROM exam_participants p JOIN exams e ON e.id=p.exam_id
      WHERE p.exam_id=? AND p.user_id=? AND e.active=1`
  ).get(eid, userId);
}
/* A participant may only read/grant consent for a study their class or exam is in. */
export function studentLinkedToStudy(user, studyId) {
  const sid = Number(studyId) || 0;
  if (!user?.id || !sid) return false;
  if (isStaffRole(user.role)) return true;
  const viaClass = db.prepare(
    `SELECT 1 FROM classes c JOIN class_members m ON m.class_id=c.id
      WHERE c.study_id=? AND m.user_id=? AND c.active=1`
  ).get(sid, user.id);
  if (viaClass) return true;
  const viaExam = db.prepare(
    `SELECT 1 FROM exams e JOIN exam_participants p ON p.exam_id=e.id
      WHERE e.study_id=? AND p.user_id=? AND e.active=1`
  ).get(sid, user.id);
  return !!viaExam;
}

/* Stable fingerprint of the wording a participant agreed to. */
export function consentTextHash(text, protocolVersion) {
  const body = `${String(protocolVersion || "").trim()}\n${String(text || "").trim()}`;
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 16);
}

/* The study a class (or scheduled exam) belongs to, if any. */
export function studyForContext({ classId, examId } = {}) {
  let studyId = null;
  if (classId) {
    const c = db.prepare("SELECT study_id FROM classes WHERE id=?").get(Number(classId) || 0);
    if (c?.study_id) studyId = c.study_id;
  }
  if (!studyId && examId) {
    const e = db.prepare("SELECT study_id FROM exams WHERE id=?").get(Number(examId) || 0);
    if (e?.study_id) studyId = e.study_id;
  }
  if (!studyId) return null;
  return db.prepare("SELECT * FROM research_studies WHERE id=?").get(studyId) || null;
}

/* When the student opens a case from the assigned-case list they do not send
   classId/examId. Session start still attributes the attempt to a class/exam
   that may require consent — so resolve that container here, or the consent
   screen is skipped and the first chat call returns 403 consent. */
export function studyContextForCase(user, caseId) {
  const cid = Number(caseId);
  if (!cid || !user?.id) return {};
  const classes = db.prepare(
    `SELECT c.id, c.study_id FROM class_cases cc
       JOIN classes c ON c.id = cc.class_id
       JOIN class_members m ON m.class_id = c.id
      WHERE cc.case_id=? AND m.user_id=? AND c.active=1 AND c.study_id IS NOT NULL`
  ).all(cid, user.id);
  for (const cl of classes) {
    const st = db.prepare("SELECT consent_required FROM research_studies WHERE id=?").get(cl.study_id);
    if (st && st.consent_required) return { classId: cl.id, examId: null };
  }
  if (classes.length) return { classId: classes[0].id, examId: null };
  const exams = db.prepare(
    `SELECT e.id, e.case_ids, e.study_id FROM exams e
       JOIN exam_participants p ON p.exam_id = e.id
      WHERE p.user_id=? AND e.active=1 AND e.study_id IS NOT NULL`
  ).all(user.id);
  const pick = [];
  for (const row of exams) {
    let ids = [];
    try { ids = JSON.parse(row.case_ids || "[]"); } catch { ids = []; }
    if (!Array.isArray(ids) || !ids.map(Number).includes(cid)) continue;
    pick.push(row);
  }
  for (const row of pick) {
    const st = db.prepare("SELECT consent_required FROM research_studies WHERE id=?").get(row.study_id);
    if (st && st.consent_required) return { classId: null, examId: row.id };
  }
  if (pick.length) return { classId: null, examId: pick[0].id };
  return {};
}

export function consentRow(userId, studyId) {
  if (!userId || !studyId) return null;
  return db.prepare("SELECT * FROM research_consents WHERE study_id=? AND user_id=?").get(studyId, userId) || null;
}

/* Everything the client needs to decide whether to show a consent screen, plus
   enough metadata to display the ethics code and protocol version with it. */
export function consentStatus(user, { classId, examId } = {}) {
  return statusForStudy(user, studyForContext({ classId, examId }));
}

/* Same thing, but for a study the caller already has in hand. Kept separate so
   asking about a study by id cannot accidentally answer "no study here" just
   because no class happens to be linked to it yet. */
export function statusForStudy(user, study) {
  if (!study) return { studyId: null, required: false, granted: true, reason: null };

  const adminManaged = study.consent_admin_managed !== 0;
  const control = db.prepare('SELECT blocked FROM research_participation_controls WHERE study_id=? AND user_id=?').get(study.id, user?.id || 0);
  const blocked = !!control?.blocked && !isStaffRole(user?.role);
  const required = blocked || (!adminManaged && !!study.consent_required && !!study.active);
  const row = consentRow(user?.id, study.id);
  const text = (study.consent_text_fa || study.consent_text_en || "").trim();
  const currentHash = consentTextHash(text, study.protocol_version);
  const stale = !!row && row.status === "granted" && !!row.consent_text_hash && row.consent_text_hash !== currentHash;
  const granted = !blocked && (!required || isStaffRole(user?.role) || (!!row && row.status === "granted"));
  return {
    studyId: study.id,
    titleFa: study.title_fa || "", titleEn: study.title_en || "",
    required,
    granted,
    adminManaged,
    blocked,
    // Distinct so the UI can tell "you declined" from "you were never asked".
    reason: granted ? null : blocked ? "research_paused" : (row?.status === "withdrawn" ? "consent_withdrawn" : "consent_required"),
    status: row?.status || (required ? "none" : "not_required"),
    mode: row?.mode || null,
    consentedAt: row?.granted_at || null,
    ethicsCode: study.ethics_code || "",
    protocolVersion: study.protocol_version || "",
    consentModes: parseModes(study.consent_modes),
    anonymize: !!study.anonymize,
    consentTextFa: study.consent_text_fa || "",
    consentTextEn: study.consent_text_en || "",
    // Lets the UI warn when the wording changed after the participant agreed.
    currentHash,
    agreedHash: row?.consent_text_hash || "",
    stale,
  };
}

export function parseModes(csv) {
  const list = String(csv || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter((x) => MODE_SET.has(x));
  return list.length ? list : ["online"];
}

/* The single gate the exam routes call. Returns { ok: true } or a denial the
   caller can turn into a 403. Staff pass through. */
export function assertConsent(user, ctx) {
  const st = consentStatus(user, ctx);
  if (!st.required || st.granted) return { ok: true };
  return { ok: false, reason: st.reason || "consent_required", studyId: st.studyId,
           titleFa: st.titleFa, titleEn: st.titleEn,
           consentTextFa: st.consentTextFa, consentTextEn: st.consentTextEn,
           ethicsCode: st.ethicsCode, protocolVersion: st.protocolVersion };
}

/* ---- Granting ------------------------------------------------------------ */

/* Online: the participant clicked "I agree" in the app themselves. */
export function grantOnlineConsent(user, studyId) {
  const study = db.prepare("SELECT * FROM research_studies WHERE id=?").get(Number(studyId) || 0);
  if (!study) return { error: "study_not_found" };
  if (!isStaffRole(user?.role) && !studentLinkedToStudy(user, study.id)) {
    return { error: "not_in_study" };
  }
  if (study.consent_admin_managed !== 0) return { error: "consent_managed_by_admin" };
  if (!parseModes(study.consent_modes).includes("online")) return { error: "consent_mode_not_permitted" };
  if (statusForStudy(user, study).blocked) return { error: "research_paused" };
  const text = study.consent_text_fa || study.consent_text_en || "";
  if (!text.trim()) {
    /* No wording on file means there is nothing to have consented to. Refusing
       here is deliberate: silently recording a consent to an empty document
       would be worse than recording nothing. */
    return { error: "consent_text_missing" };
  }
  const hash = consentTextHash(text, study.protocol_version);
  upsertConsent({
    studyId: study.id, userId: user.id, pseudonym: pseudonymFor(user.id, `study:${study.id}`),
    mode: "online", recordedBy: null, note: "",
    protocolVersion: study.protocol_version || "", textHash: hash,
  });
  return { ok: true, status: "granted", hash };
}

/* Offline: a researcher took the consent on paper (or verbally) and is
   recording it here. The researcher's identity and a note are mandatory —
   this row is the only evidence the consent exists. */
export function recordOfflineConsent({ studyId, userId, pseudonym, mode, recordedBy, note }) {
  const study = db.prepare("SELECT * FROM research_studies WHERE id=?").get(Number(studyId) || 0);
  if (!study) return { error: "study_not_found", status: 404 };
  const m = String(mode || "").toLowerCase();
  if (m === "online") return { error: "online_consent_must_be_self_granted", status: 400 };
  if (!MODE_SET.has(m)) return { error: "unknown_consent_mode", status: 400 };
  if (!parseModes(study.consent_modes).includes(m)) {
    return { error: "consent_mode_not_permitted", status: 400 };
  }
  if (!String(note || "").trim()) return { error: "note_required", status: 400 };
  const uid = Number(userId) || null;
  if (!uid && !String(pseudonym || "").trim()) return { error: "participant_required", status: 400 };

  const text = study.consent_text_fa || study.consent_text_en || "";
  upsertConsent({
    studyId: study.id, userId: uid,
    pseudonym: uid ? pseudonymFor(uid, `study:${study.id}`) : String(pseudonym).slice(0, 64),
    mode: m, recordedBy: Number(recordedBy) || null, note: String(note).slice(0, 500),
    protocolVersion: study.protocol_version || "", textHash: consentTextHash(text, study.protocol_version),
  });
  return { ok: true, status: "granted", mode: m };
}

/* Withdrawal. Stored, not deleted — the fact that someone withdrew is itself
   part of the study record. */
export function withdrawConsent(user, studyId, note = "") {
  const row = consentRow(user?.id, studyId);
  if (!row) return { error: "no_consent_on_record", status: 404 };
  db.prepare(`UPDATE research_consents SET status='withdrawn', withdrawn_at=datetime('now'), note=? WHERE id=?`)
    .run(String(note || "").slice(0, 500) || row.note, row.id);
  persistNow();
  return { ok: true, status: "withdrawn" };
}

/* One live decision per identified participant: update in place rather than
   piling up rows. (SQLite needs the explicit SELECT because NULLs are distinct
   in a UNIQUE index.) */
function upsertConsent({ studyId, userId, pseudonym, mode, recordedBy, note, protocolVersion, textHash }) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const existing = userId ? consentRow(userId, studyId) : null;
  if (existing) {
    db.prepare(`UPDATE research_consents
      SET mode=?, status='granted', consent_text_hash=?, protocol_version=?, recorded_by=?, note=?,
          granted_at=?, withdrawn_at=NULL
      WHERE id=?`).run(mode, textHash, protocolVersion, recordedBy, note, now, existing.id);
  } else {
    db.prepare(`INSERT INTO research_consents
      (study_id,user_id,pseudonym,mode,status,consent_text_hash,protocol_version,recorded_by,note,granted_at)
      VALUES (?,?,?,?, 'granted', ?,?,?,?,?)`)
      .run(studyId, userId, pseudonym, mode, textHash, protocolVersion, recordedBy, note, now);
  }
  persistNow();
}

/* ---- Read-back for the researchers --------------------------------------- */

/* The roster. `anonymize` replaces the student number with the study
   pseudonym so the export can leave the building without identifiers. */
export function consentRoster(studyId, { anonymize = false, universityId = null } = {}) {
  const study = db.prepare("SELECT * FROM research_studies WHERE id=?").get(Number(studyId) || 0);
  if (!study) return null;
  const anon = anonymize || !!study.anonymize;
  let rows = db.prepare(`
    SELECT c.*, u.student_no, u.role AS user_role, u.university_id AS university_id,
           COALESCE(u.name_fa,u.name_en,u.username) AS user_name,
           COALESCE(r.name_fa,r.name_en,r.username) AS recorder_name
    FROM research_consents c
    LEFT JOIN users u ON u.id=c.user_id
    LEFT JOIN users r ON r.id=c.recorded_by
    WHERE c.study_id=? ORDER BY c.id`).all(Number(studyId) || 0);
  if (universityId != null) {
    const uni = Number(universityId) || 0;
    rows = rows.filter((x) => x.user_id && (Number(x.university_id) || 1) === uni);
  }
  const text = study.consent_text_fa || study.consent_text_en || "";
  const currentHash = consentTextHash(text, study.protocol_version);
  return {
    study: {
      id: study.id, titleFa: study.title_fa, titleEn: study.title_en,
      ethicsCode: study.ethics_code || "", protocolVersion: study.protocol_version || "",
      consentModes: parseModes(study.consent_modes), anonymized: anon,
      active: !!study.active, consentRequired: !!study.consent_required,
    },
    counts: {
      total: rows.length,
      granted: rows.filter((x) => x.status === "granted").length,
      withdrawn: rows.filter((x) => x.status === "withdrawn").length,
      byMode: CONSENT_MODES.reduce((m, k) => { m[k] = rows.filter((x) => x.mode === k && x.status === "granted").length; return m; }, {}),
      stale: rows.filter((x) => x.status === "granted" && x.consent_text_hash && x.consent_text_hash !== currentHash).length,
    },
    consents: rows.map((x) => ({
      id: x.id,
      // Identifiers leave the export only when anonymisation is off.
      studentNo: anon ? "" : (x.student_no || ""),
      participantName: anon ? "" : (x.user_name || ""),
      userId: anon ? null : (x.user_id || null),
      pseudonym: x.pseudonym || "",
      mode: x.mode,
      status: x.status,
      note: x.note || "",
      protocolVersion: x.protocol_version || "",
      consentTextHash: x.consent_text_hash || "",
      stale: x.status === "granted" && !!x.consent_text_hash && x.consent_text_hash !== currentHash,
      recorder: x.recorder_name || "",
      grantedAt: x.granted_at,
      withdrawnAt: x.withdrawn_at,
    })),
  };
}
