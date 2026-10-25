/* audit.js — immutable audit log for admin write actions.
   Records: actor, action, resource, detail (before/after), IP, timestamp. */
import { db, persistNow } from "../db.js";

export function audit(req, action, resource, detail) {
  try {
    const actor = req?.user || {};
    const name = actor.username || actor.name_fa || actor.name_en || "system";
    const ip = (req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "").toString().split(",")[0];
    db.prepare(`INSERT INTO audit_log (actor_id, actor_name, action, resource, detail, ip) VALUES (?,?,?,?,?,?)`)
      .run(actor.id || null, name, action, resource || "", detail ? JSON.stringify(detail) : null, ip);
    persistNow();
  } catch { /* never let logging break the request */ }
}

export function listAudit({ limit = 100, action = "", actor = "" } = {}) {
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const args = [];
  if (action) { sql += " AND action LIKE ?"; args.push(`%${action}%`); }
  if (actor) { sql += " AND actor_name LIKE ?"; args.push(`%${actor}%`); }
  sql += " ORDER BY id DESC LIMIT ?"; args.push(limit);
  return db.prepare(sql).all(...args);
}
