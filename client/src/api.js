/* Thin fetch wrapper that injects the JWT and parses JSON.
   Network / timeout / HTML-error-page failures become a typed error with
   `status: 0` and optional `data.stage` so the virtual-patient UI can say
   WHERE the path stopped instead of a silent spinner or "Failed to fetch". */
import { safeLocal } from "./lib/storage.js";
const TOKEN_KEY = "medlab_token";
const etags = new Map();

export function getToken() { return safeLocal.getItem(TOKEN_KEY); }
export function setToken(t) { t ? safeLocal.setItem(TOKEN_KEY, t) : safeLocal.removeItem(TOKEN_KEY); }

// R89: identical GETs that are already in flight share one request. The key includes the
// token, so two accounts in one browser never share a response. The entry is removed when the
// request settles, so later calls always go to the network (or the ETag revalidation path).
const inflight = new Map();
function req(method, path, body, opts = {}) {
  if (method !== "GET") return reqOnce(method, path, body, opts);
  const key = `${getToken()}|${path}|${opts.revalidate ? "r" : ""}`;
  if (inflight.has(key)) return inflight.get(key);
  // While the key is present no other request can take its place, so a plain delete is safe.
  const p = reqOnce(method, path, body, opts).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function reqOnce(method, path, body, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.headers) Object.assign(headers, opts.headers);
  if (method === "GET" && opts.revalidate) {
    const prev = etags.get(path);
    if (prev) headers["If-None-Match"] = prev;
  }
  const ac = new AbortController();
  const ms = Number(opts.timeoutMs);
  const timer = Number.isFinite(ms) && ms > 0 ? setTimeout(() => ac.abort(), ms) : null;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
  } catch (e) {
    const timeout = e?.name === "AbortError";
    const err = new Error(timeout ? "timeout" : "network");
    err.status = 0;
    err.data = { error: timeout ? "timeout" : "network", stage: opts.stage };
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 304) return undefined;
  if (res.status === 401) {
    const hadToken = !!token;
    setToken(null);
    // Only toast for real sessions (not the initial /auth/me probe without a token)
    if (hadToken && path !== "/auth/me" && path !== "/auth/login" && typeof window !== "undefined") {
      try { window.dispatchEvent(new CustomEvent("medlab-toast", { detail: path === "/auth/me" ? "" : (document.documentElement.lang === "fa" ? "نشست شما منقضی شد — دوباره وارد شوید." : "Session expired — please sign in again.") })); } catch {}
      try { window.dispatchEvent(new CustomEvent("medlab-auth-expired")); } catch {}
    }
  }
  const ct = res.headers.get("content-type") || "";
  let data;
  try {
    data = ct.includes("json") ? await res.json() : await res.text();
  } catch {
    data = { error: "bad_response", stage: opts.stage };
    if (res.ok) {
      const err = new Error("bad_response");
      err.status = 0;
      err.data = data;
      throw err;
    }
  }
  if (res.ok && typeof data === "string") {
    const err = new Error("bad_response");
    err.status = 0;
    err.data = { error: "bad_response", stage: opts.stage };
    throw err;
  }
  if (!res.ok) {
    if (data && typeof data === "object") {
      if (opts.stage && !data.stage) data.stage = opts.stage;
    } else {
      data = { error: String(data || `HTTP ${res.status}`), stage: opts.stage };
    }
    const msg = (data && (data.message_fa || data.message_en || data.error)) || `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : `HTTP ${res.status}`);
    err.data = data;
    err.status = res.status;
    // R64: the server closed this timed encounter or run. Screens listen and finish from the stored answers.
    if (data.error === "session_expired") { try { window.dispatchEvent(new CustomEvent("medlab-session-expired")); } catch { /* no window */ } }
    throw err;
  }
  if (method === "GET") {
    const etag = res.headers.get("etag");
    if (etag) etags.set(path, etag);
  }
  return data;
}

export function loadFailKind(e) {
  if (e?.data?.error === "timeout") return "timeout";
  if (!e?.status) return "network";
  if (e.status === 401) return "auth";
  if (e.status === 403 || e.status === 404) return "denied";
  return "server";
}
export function loadFailText(kind, lang) {
  const fa = lang === "fa";
  if (kind === "timeout") return fa ? "زمان این مرحله تمام شد. دوباره تلاش کنید." : "This step timed out. Please try again.";
  if (kind === "auth") return fa ? "نشست شما منقضی شده. دوباره وارد شوید." : "Your session expired. Please sign in again.";
  if (kind === "denied") return fa ? "دسترسی به این مورد ندارید." : "You don't have access to this item.";
  if (kind === "server") return fa ? "سرور خطا داد. دوباره تلاش کنید." : "The server returned an error. Please try again.";
  return fa ? "اتصال قطع شد. دوباره تلاش کنید." : "Connection lost. Please try again.";
}

export const api = {
  get: (p, o) => req("GET", p, undefined, o),
  post: (p, b, o) => req("POST", p, b, o),
  put: (p, b, o) => req("PUT", p, b, o),
  del: (p, o) => req("DELETE", p, undefined, o),
  login: (username, password) => req("POST", "/auth/login", { username, password }),
  register: (payload) => req("POST", "/auth/register", payload),
  me: () => req("GET", "/auth/me"),
  // R70: no token in the URL (URLs end up in logs and history). The session cookie is sent for this same-origin link.
  csvUrl: () => `/api/reports/export.csv`,
};
