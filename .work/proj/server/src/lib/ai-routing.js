import { createHash } from 'node:crypto';

// Process-local circuit breakers. No keys, prompts or provider error bodies in diagnostics.
const circuits = new Map();
const slowCircuits = new Map(); // Timeout suitability differs for chat and evaluation.
const groups = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
const text = (v, n = 500) => String(v ?? '').trim().slice(0, n);
export function routingSettings(input = {}, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI routing: invalid settings');
  const boolean = (value, name) => {
    if (value !== undefined && typeof value !== 'boolean') throw new Error(`AI routing: ${name} must be boolean`);
  };
  boolean(input.routingEnabled, 'routingEnabled');
  const raw = input.routes === undefined ? (previous.routes ?? []) : input.routes;
  if (!Array.isArray(raw) || raw.length > 8) throw new Error('AI routing: maximum 8 connections');
  const ids = new Set();
  const routes = raw.map((r, i) => {
    if (!r || typeof r !== 'object') throw new Error('AI routing: invalid connection');
    const id = text(r.id || `route-${i + 1}`, 80);
    if (ids.has(id)) throw new Error('AI routing: duplicate connection id');
    ids.add(id);
    boolean(r.enabled, 'enabled');
    boolean(r.clearApiKey, 'clearApiKey');
    const old = (previous.routes || []).find(x => x.id === id);
    const sameDestination = old && text(r.provider, 80) === text(old.provider, 80) && text(r.baseUrl) === text(old.baseUrl);
    const incomingKey = text(r.apiKey, 4096);
    const apiKey = r.clearApiKey ? '' : (incomingKey || (sameDestination ? text(old.apiKey, 4096) : ''));

    const cooldown = Number(r.cooldownSeconds ?? 60);
    if (!Number.isFinite(cooldown) || cooldown < 5 || cooldown > 86400) throw new Error('AI routing: cooldown must be 5–86400 seconds');
    return { id, label: text(r.label || `Connection ${i + 1}`, 100), enabled: r.enabled ?? old?.enabled ?? false,
      provider: text(r.provider, 80), model: text(r.model, 200), apiKey, baseUrl: text(r.baseUrl),
      quotaGroup: text(r.quotaGroup || 'openrouter-shared', 100), cooldownSeconds: cooldown };
  });
  return { routingEnabled: Boolean(input.routingEnabled ?? previous.routingEnabled), routes };
}
export function effectiveRouting(config) {
  if (!config.routingEnabled) return config;
  const first = config.routes?.find(r => r.enabled && r.apiKey && r.model && (r.provider || r.baseUrl));
  // Deliberately no env/legacy key inheritance inside individual connections.
  return { ...config, provider: first?.provider || '', model: first?.model || '',
    apiKey: first?.apiKey || '', baseUrl: first?.baseUrl || '' };
}
export function providerFailure(status, headers, detail = '') {
  const e = new Error(`AI provider error ${status}`);
  e.status = status;
  const retry = headers?.get?.('retry-after');
  if (retry) {
    const seconds = Number(retry);
    e.retryAt = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(retry);
  }
  if (!Number.isFinite(e.retryAt)) {
    const reset = headers?.get?.('x-ratelimit-reset');
    if (reset) {
      const value = Number(reset);
      e.retryAt = Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : Date.parse(reset);
    }
  }
  let body;
  try { body = JSON.parse(detail); } catch { body = {}; }
  const metadata = body?.error?.metadata || {};
  // Upstream provider limit: another free model may still work. Unknown 429s
  // are conservatively treated as a shared platform limit, not key rotation.
  const platformHeaders = headers?.get?.('x-ratelimit-limit') != null && headers?.get?.('x-ratelimit-remaining') != null;
  e.upstream = !platformHeaders && Boolean(metadata.provider_name || metadata.provider_code);
  // Do not classify a limit from opaque IDs or echoed diagnostic fields.
  const diagnostic = body?.error ? `${body.error.message || ''} ${body.error.code || ''}` : detail;
  e.daily = status === 429 && !e.upstream && /(?:per.day|daily|free.model.daily|requests.today)/i.test(diagnostic);
  return e;
}
const freeRouter = c => /openrouter/i.test(`${c.provider} ${c.baseUrl}`) && (c.model.endsWith(':free') || c.model === 'openrouter/free');
export function resetRoutingState() { circuits.clear(); slowCircuits.clear(); groups.clear(); }
export async function routeCompletion(config, messages, opts, send) {
  delete config.lastRoute;
  if (!config.routingEnabled) return send(config, messages, opts);
  const candidates = (config.routes || []).filter(r => r.enabled && r.apiKey && r.model && (r.provider || r.baseUrl));
  const evaluation = opts?.workload === 'evaluation';
  const cap = evaluation ? 45_000 : 50_000;
  const total = Math.max(1000, Math.min(Number(opts?.totalTimeoutMs) || cap, cap));
  const attemptCap = evaluation ? 40_000 : 15_000;
  const deadline = Date.now() + total;
  let lastStatus = 0, lastCode = null;
  for (const route of candidates) {
    const now = Date.now();
    if (now >= deadline) break;
    // Credential and endpoint edits invalidate that connection's old breaker.
    const id = hash(JSON.stringify([route.id, route.provider, route.baseUrl, route.model, route.apiKey]));
    const group = hash(route.quotaGroup || 'openrouter-shared');
    const state = circuits.get(id);
    const slowKey = `${id}:${evaluation ? 'evaluation' : 'interactive'}`;
    const slowState = slowCircuits.get(slowKey);
    if (state?.probing || state?.until > now || slowState?.probing || slowState?.until > now || (freeRouter(route) && (groups.get(group) || 0) > now)) continue;
    if (slowState) slowState.probing = true;
    if (state) state.probing = true; // one half-open probe; concurrent calls fall through
    try {
      const result = await send(route, messages, { ...opts, timeoutMs: Math.min(opts?.timeoutMs || attemptCap, attemptCap, deadline - now) });
      if (circuits.get(id) === state) circuits.delete(id);
      if (slowCircuits.get(slowKey) === slowState) slowCircuits.delete(slowKey);
      config.lastRoute = { id: route.id, label: route.label, provider: route.provider, model: route.actualModel || route.model };
      return result;
    } catch (error) {
      lastStatus = Number(error?.status) || 0;
      lastCode = lastStatus === 429 ? 'rate_limit' : lastStatus === 402 ? 'credits'
        : lastStatus === 401 ? 'credentials' : /timed? ?out|aborted/i.test(String(error?.message || '')) ? 'timeout' : 'provider_unavailable';
      if (lastStatus === 403) {
        if (circuits.get(id) === state) circuits.delete(id);
      if (slowCircuits.get(slowKey) === slowState) slowCircuits.delete(slowKey);
        throw new Error("AI provider refused access (403)");
      }
      const delay = (route.cooldownSeconds || 60) * 1000;
      let until = Date.now() + delay;
      if (Number.isFinite(error?.retryAt) && error.retryAt > Date.now()) until = error.retryAt;
      const hasResetHint = Number.isFinite(error?.retryAt) && error.retryAt > Date.now();
      if (error?.daily && freeRouter(route) && !hasResetHint) {
        const d = new Date();
        until = Math.max(until, Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
      }
      const timeoutOnly = lastCode === 'timeout' && !lastStatus;
      const store = timeoutOnly ? slowCircuits : circuits;
      const storeKey = timeoutOnly ? slowKey : id;
      if (timeoutOnly && circuits.get(id) === state && state) state.probing = false;
      if (!timeoutOnly && slowCircuits.get(slowKey) === slowState && slowState) slowState.probing = false;
      until = Math.max(until, store.get(storeKey)?.until || 0);
      store.set(storeKey, { until, probing: false });
      if (freeRouter(route) && lastStatus === 429 && !error.upstream) groups.set(group, Math.max(groups.get(group) || 0, until));

    }
  }
  // Bound stale process-local state without storing credentials in map keys.
  if (circuits.size > 2000) for (const [k, v] of circuits) if (v.until < Date.now() && !v.probing) circuits.delete(k);
  if (slowCircuits.size > 2000) for (const [k, v] of slowCircuits) if (v.until < Date.now() && !v.probing) slowCircuits.delete(k);
  if (groups.size > 2000) for (const [k, v] of groups) if (v < Date.now()) groups.delete(k);
  const failure = new Error(`AI connections unavailable or cooling down${lastStatus ? ` (${lastStatus})` : ''}`);
  failure.code = lastCode || 'cooldown';
  throw failure;
}
