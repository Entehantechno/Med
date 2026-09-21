/* rbac.js — central permission map (single source of truth).
   Hierarchical RBAC: admin inherits everything. Mid-level roles get a curated,
   least-privilege subset. Both server middleware and the client read this shape
   (the client fetches it via /api/auth/me -> perms).

   Permissions use "domain.action" naming so they read clearly and audit well. */

export const PERMISSIONS = {
  // university side
  "uni.view": "View the university admin area",
  "uni.classes": "Manage classes",
  "uni.exams": "Manage exams & results",
  "uni.users": "Manage staff & students",
  "uni.content": "Manage cases, flashcards, catalogs, checklists",
  "uni.ai": "Configure AI & prompts",
  "uni.reports": "View reports",
  // learner side
  "learn.view": "View the learner admin area",
  "learn.users": "Manage learner accounts (ban/reset/adjust)",
  "learn.users.delete": "Delete learner accounts",
  "learn.users.impersonate": "Impersonate users",
  "learn.content": "Manage learner content & microlearning",
  "learn.ads": "Manage ads",
  "learn.flags": "Toggle feature flags",
  "learn.settings": "Change global settings",
  "learn.audit": "View the audit log",
  "learn.data": "Export data",
  "learn.pricing": "Change subscription prices",
  "learn.support": "Answer support & feedback tickets",
  "store.manage": "Manage the course store (courses, lessons, pricing)",
};

// role → list of permission keys. "*" means all (admin).
export const ROLE_PERMS = {
  admin: ["*"],
  // mid-level: content manager works only in the learner universe, content only
  content_manager: ["learn.view", "learn.content"],
  // mid-level: support handles learner accounts + answers support tickets
  support: ["learn.view", "learn.users", "learn.users.impersonate", "learn.audit", "learn.support"],
  // teachers keep their existing university-scoped access
  teacher: ["uni.view", "uni.classes", "uni.exams", "uni.users", "uni.content", "uni.reports"],
  // students / learners have no admin permissions
  student: [],
  learner: [],
};

export const ADMIN_ROLES = ["admin", "content_manager", "support"];

// Roles whose permissions an admin may edit from the UI (admin stays all-powerful).
export const EDITABLE_ROLES = ["content_manager", "support", "teacher", "learner", "student"];

/* Admin-configurable overrides (stored in DB via settings key "role_perms").
   loadRolePermOverrides() is injected at startup so this module stays DB-free. */
let _overrides = null;
export function setRolePermOverrides(obj) { _overrides = obj && typeof obj === "object" ? obj : null; }
function effectivePerms(role) {
  if (_overrides && Array.isArray(_overrides[role])) return _overrides[role];
  return ROLE_PERMS[role] || [];
}

export function permsFor(role) {
  const list = effectivePerms(role);
  if (list.includes("*")) return Object.keys(PERMISSIONS);
  return list;
}

export function can(role, perm) {
  if (role === "admin") return true;                    // admin is always all-powerful
  const list = effectivePerms(role);
  if (list.includes("*")) return true;
  return list.includes(perm);
}

/* Current effective role→perms map (defaults merged with overrides) for the editor. */
export function currentRolePerms() {
  const out = {};
  for (const role of EDITABLE_ROLES) out[role] = [...effectivePerms(role)];
  return out;
}

/* Express middleware: require a specific permission. */
// Accepts one permission OR a list — the user needs ANY one of them (OR).
// This lets a route be reachable by either a competitive-side perm (learn.users)
// or a university-side perm (uni.users), e.g. user management shared by both.
export function requirePerm(...perms) {
  const list = perms.flat();
  return (req, res, next) => {
    if (!req.user || !list.some((p) => can(req.user.role, p)))
      return res.status(403).json({ error: "forbidden", need: list.join(" | ") });
    next();
  };
}
