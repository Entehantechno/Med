import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { requirePerm } from "../lib/rbac.js";
import { audit } from "../lib/audit.js";
import {
  currentUniversityId,
  listReferenceCatalog,
  referenceCatalogRow,
  publicReference,
  listUniversityPolicies,
  policyRow,
  publicPolicy,
  normalizeReferenceInput,
  normalizePolicyInput,
  policyReadiness,
  referenceSnapshotForPolicy,
  snapshotForCaseRow,
} from "../lib/reference-governance.js";
import { createPortableRouter } from "./portable.js";
const r = Router();
const manager = [
    authRequired,
    requireRole("admin", "teacher"),
    requirePerm("uni.content"),
  ],
  platform = [authRequired, requireRole("admin")];
const int = (v) =>
  Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const university = (id) =>
  id
    ? db
        .prepare(
          "SELECT id,name_fa,name_en,code,active FROM universities WHERE id=?",
        )
        .get(id) || null
    : null;
function selected(req, { all = false } = {}) {
  if (req.user.role === "admin") {
    const id = int(
      req.body?.university_id ??
        req.query?.university_id ??
        req.params?.universityId,
    );
    return id ? university(id) : all ? null : null;
  }
  return university(currentUniversityId(req.user));
}
function requireUni(req, res, opts = {}) {
  const u = selected(req, opts);
  if (!u && !(opts.all && req.user.role === "admin")) {
    res
      .status(403)
      .json({
        error: "university_context_required",
        message_fa: "دانشگاه معتبر برای این عملیات تعیین نشده است.",
      });
    return null;
  }
  return u;
}
function refreshCases(policyId) {
  const snap = referenceSnapshotForPolicy(policyId);
  db.prepare(
    "UPDATE cases SET reference_snapshot_json=? WHERE reference_policy_id=?",
  ).run(JSON.stringify(snap), Number(policyId));
}
function validate(candidate) {
  if (!candidate.course_code) return "course_code_required";
  if (
    candidate.status === "approved" &&
    !policyReadiness({
      ...candidate,
      reference_active:
        referenceCatalogRow(candidate.reference_id)?.active || 0,
      reference_rights_status:
        referenceCatalogRow(candidate.reference_id)?.rights_status || "blocked",
    }).ready
  )
    return "policy_not_ready";
  return null;
}
r.get("/references", ...manager, (req, res) =>
  res.json({
    references: listReferenceCatalog({
      activeOnly: req.query.all !== "1" || req.user.role !== "admin",
    }),
  }),
);
r.post("/references", ...platform, (req, res) => {
  const x = normalizeReferenceInput(req.body || {});
  if (!x.code || !x.title_en)
    return res.status(400).json({ error: "reference_code_and_title_required" });
  if (db.prepare("SELECT 1 FROM reference_catalog WHERE code=?").get(x.code))
    return res.status(409).json({ error: "reference_code_exists" });
  const q = db.prepare(
    "INSERT INTO reference_catalog (code,title_fa,title_en,short_title,publisher,edition,publication_year,isbn,source_url,cover_url,rights_status,rights_note_fa,rights_note_en,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const out = q.run(
    x.code,
    x.title_fa,
    x.title_en,
    x.short_title,
    x.publisher,
    x.edition,
    x.publication_year,
    x.isbn,
    x.source_url,
    x.cover_url,
    x.rights_status,
    x.rights_note_fa,
    x.rights_note_en,
    x.active,
  );
  persistNow();
  const row = referenceCatalogRow(out.lastInsertRowid);
  audit(req, "academic.reference.create", `reference:${row.id}`, {
    code: row.code,
  });
  res.status(201).json({ reference: publicReference(row) });
});
r.put("/references/:id", ...platform, (req, res) => {
  const old = referenceCatalogRow(req.params.id);
  if (!old) return res.status(404).json({ error: "not_found" });
  const x = normalizeReferenceInput({ ...old, ...(req.body || {}) });
  if (!x.code || !x.title_en)
    return res.status(400).json({ error: "reference_code_and_title_required" });
  const dup = db
    .prepare("SELECT id FROM reference_catalog WHERE code=? AND id<>?")
    .get(x.code, old.id);
  if (dup) return res.status(409).json({ error: "reference_code_exists" });
  db.prepare(
    "UPDATE reference_catalog SET code=?,title_fa=?,title_en=?,short_title=?,publisher=?,edition=?,publication_year=?,isbn=?,source_url=?,cover_url=?,rights_status=?,rights_note_fa=?,rights_note_en=?,active=?,version=version+1,updated_at=datetime('now') WHERE id=?",
  ).run(
    x.code,
    x.title_fa,
    x.title_en,
    x.short_title,
    x.publisher,
    x.edition,
    x.publication_year,
    x.isbn,
    x.source_url,
    x.cover_url,
    x.rights_status,
    x.rights_note_fa,
    x.rights_note_en,
    x.active,
    old.id,
  );
  for (const p of db
    .prepare("SELECT id FROM course_reference_policies WHERE reference_id=?")
    .all(old.id))
    refreshCases(p.id);
  persistNow();
  audit(req, "academic.reference.update", `reference:${old.id}`, {
    version: old.version + 1,
  });
  res.json({ reference: publicReference(referenceCatalogRow(old.id)) });
});
r.get("/policies", ...manager, (req, res) => {
  const u = requireUni(req, res, { all: true });
  if (u === null && req.user.role === "admin") {
    const us = db
      .prepare(
        "SELECT id,name_fa,name_en,code,active FROM universities ORDER BY id",
      )
      .all();
    return res.json({
      policies: us.flatMap((x) =>
        listUniversityPolicies(x.id, {
          includeInactive: req.query.all === "1",
        }).map((p) => ({ ...p, university: x })),
      ),
    });
  }
  if (!u) return;
  res.json({
    university: u,
    policies: listUniversityPolicies(u.id, {
      includeInactive: req.query.all === "1" && req.user.role === "admin",
    }),
  });
});
r.post("/policies", ...manager, (req, res) => {
  const u = requireUni(req, res);
  if (!u) return;
  const x = normalizePolicyInput(req.body || {}),
    candidate = {
      ...x,
      university_id: u.id,
      active: x.active,
      reference_active: referenceCatalogRow(x.reference_id)?.active || 0,
      reference_rights_status:
        referenceCatalogRow(x.reference_id)?.rights_status || "blocked",
    };
  const err = validate(candidate);
  if (err) return res.status(422).json({ error: err });
  if (
    db
      .prepare(
        "SELECT id FROM course_reference_policies WHERE university_id=? AND course_code=?",
      )
      .get(u.id, x.course_code)
  )
    return res.status(409).json({ error: "course_policy_exists" });
  const approved = x.status === "approved" ? req.user.id : null;
  const out = db
    .prepare(
      `INSERT INTO course_reference_policies (university_id,course_code,course_name_fa,course_name_en,specialty_fa,specialty_en,reference_id,source_anchor,citation_label_fa,citation_label_en,teaching_basis_fa,teaching_basis_en,content_mode,status,approval_note,approved_by,approved_at,active,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END,?,?)`,
    )
    .run(
      u.id,
      x.course_code,
      x.course_name_fa,
      x.course_name_en,
      x.specialty_fa,
      x.specialty_en,
      x.reference_id,
      x.source_anchor,
      x.citation_label_fa,
      x.citation_label_en,
      x.teaching_basis_fa,
      x.teaching_basis_en,
      x.content_mode,
      x.status,
      x.approval_note,
      approved,
      approved,
      x.active,
      req.user.id,
    );
  refreshCases(out.lastInsertRowid);
  persistNow();
  const p = policyRow(out.lastInsertRowid);
  audit(req, "academic.reference_policy.create", `reference-policy:${p.id}`, {
    university_id: u.id,
    course_code: p.course_code,
  });
  res.status(201).json({ policy: publicPolicy(p) });
});
r.put("/policies/:id", ...manager, (req, res) => {
  const old = policyRow(req.params.id);
  if (!old) return res.status(404).json({ error: "not_found" });
  const u = requireUni(req, res);
  if (!u) return;
  if (Number(old.university_id) !== Number(u.id))
    return res.status(403).json({ error: "wrong_university" });
  const x = normalizePolicyInput({ ...old, ...(req.body || {}) }),
    candidate = {
      ...x,
      university_id: u.id,
      reference_active: referenceCatalogRow(x.reference_id)?.active || 0,
      reference_rights_status:
        referenceCatalogRow(x.reference_id)?.rights_status || "blocked",
    };
  const err = validate(candidate);
  if (err) return res.status(422).json({ error: err });
  const dup = db
    .prepare(
      "SELECT id FROM course_reference_policies WHERE university_id=? AND course_code=? AND id<>?",
    )
    .get(u.id, x.course_code, old.id);
  if (dup) return res.status(409).json({ error: "course_policy_exists" });
  const approved = x.status === "approved" ? req.user.id : null;
  db.prepare(
    `UPDATE course_reference_policies SET course_code=?,course_name_fa=?,course_name_en=?,specialty_fa=?,specialty_en=?,reference_id=?,source_anchor=?,citation_label_fa=?,citation_label_en=?,teaching_basis_fa=?,teaching_basis_en=?,content_mode=?,status=?,approval_note=?,approved_by=?,approved_at=CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END,active=?,version=version+1,updated_at=datetime('now') WHERE id=?`,
  ).run(
    x.course_code,
    x.course_name_fa,
    x.course_name_en,
    x.specialty_fa,
    x.specialty_en,
    x.reference_id,
    x.source_anchor,
    x.citation_label_fa,
    x.citation_label_en,
    x.teaching_basis_fa,
    x.teaching_basis_en,
    x.content_mode,
    x.status,
    x.approval_note,
    approved,
    approved,
    x.active,
    old.id,
  );
  refreshCases(old.id);
  persistNow();
  audit(req, "academic.reference_policy.update", `reference-policy:${old.id}`, {
    university_id: u.id,
    version: old.version + 1,
  });
  res.json({ policy: publicPolicy(policyRow(old.id)) });
});
r.get("/status", ...manager, (req, res) => {
  const u = requireUni(req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `SELECT p.*,c.id case_id,c.reference_policy_id,c.reference_snapshot_json,r.active reference_active,r.rights_status reference_rights_status FROM cases c LEFT JOIN course_reference_policies p ON p.id=c.reference_policy_id LEFT JOIN reference_catalog r ON r.id=p.reference_id WHERE c.university_id=? AND c.active=1 AND NOT COALESCE(CASE WHEN json_valid(c.data_json) THEN json_extract(c.data_json,'$.track')='learn' ELSE 0 END,0)`,
    )
    .all(u.id);
  const blocked = [],
    ready = rows.reduce((n, row) => {
      const state = snapshotForCaseRow(row).readiness;
      if (!state.ready)
        blocked.push({
          case_id: row.case_id,
          reference_policy_id: row.reference_policy_id || null,
          readiness: state,
        });
      return n + (state.ready ? 1 : 0);
    }, 0);
  res.json({
    university: u,
    cases: rows.length,
    referenceReadyCases: ready,
    blockedCases: blocked,
  });
});
r.use(
  "/portable",
  createPortableRouter({
    selectedUniversity: selected,
    universityExists: university,
  }),
);
export default r;
