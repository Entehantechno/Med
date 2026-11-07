/* login-anomaly.js — record failed sign-ins and raise one alert when a burst crosses a
   threshold. Stores no username and no raw IP: the account is a short SHA-256 digest and
   the client is the keyed digest from ip-privacy.js. The alert is written once per
   threshold crossing (count === threshold), so a long attack does not flood the log. */
import crypto from "node:crypto";
import { db } from "../db.js";
import { storedIpFromReq } from "./ip-privacy.js";

const WINDOW_SQL = "-15 minutes";
// The per-account+IP limiter allows about 5 attempts per window from one client, so 5
// failures on one account is the single-client signal; a distributed guess from many
// clients shows up as the account count, and a spray from one client as the client count.
export const ACCOUNT_THRESHOLD = 5;    // failures against one account in the window
export const IP_THRESHOLD = 20;        // failures from one client in the window (below the 30/window limiter)

const digest = (v) => crypto.createHash("sha256").update(String(v || "").toLowerCase()).digest("hex").slice(0, 16);

export function recordLoginFailure(req, username) {
  try {
    const acct = digest(username);
    const ip = storedIpFromReq(req);
    const ua = String(req?.headers?.["user-agent"] || "").slice(0, 300);
    db.prepare(`INSERT INTO security_events (user_id, kind, status, method, path, ip, user_agent, detail)
      VALUES (NULL, 'login_failed', 401, 'POST', '/api/auth/login', ?, ?, ?)`).run(ip, ua, JSON.stringify({ acct }));
    const countAcct = db.prepare(
      `SELECT COUNT(*) n FROM security_events WHERE kind='login_failed' AND detail = ? AND created_at >= datetime('now', ?)`
    ).get(JSON.stringify({ acct }), WINDOW_SQL).n;
    const countIp = db.prepare(
      `SELECT COUNT(*) n FROM security_events WHERE kind='login_failed' AND ip = ? AND created_at >= datetime('now', ?)`
    ).get(ip, WINDOW_SQL).n;
    if (countAcct === ACCOUNT_THRESHOLD) raise("account", acct, countAcct, ip);
    if (countIp === IP_THRESHOLD) raise("client", acct, countIp, ip);
  } catch (e) {
    console.error("[auth] login-failure accounting failed:", e?.message || e);
  }
}

function raise(scope, acct, count, ip) {
  db.prepare(`INSERT INTO security_events (user_id, kind, status, method, path, ip, user_agent, detail)
    VALUES (NULL, 'login_anomaly', 0, 'POST', '/api/auth/login', ?, '', ?)`)
    .run(ip, JSON.stringify({ scope, acct, count, windowMin: 15 }));
  console.warn(`[security] login anomaly: ${count} failed sign-ins in 15 min (scope=${scope}, account=${acct})`);
}
