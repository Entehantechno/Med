/* R89: slow-request log. Stand-in for distributed tracing until an OpenTelemetry exporter is
   configured: any request slower than SLOW_REQUEST_MS (default 1000) writes one line with the
   method, route template (or path without query string), status and duration. No query string,
   headers, or body are logged, so tokens and personal data stay out of the log. */
export function slowThresholdMs(env = process.env) {
  const n = Number(env.SLOW_REQUEST_MS);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function slowRequestLine({ method, route, path, status, durMs }) {
  const where = String(route || path || "").split("?")[0].slice(0, 200);
  return `[slow] ${String(method || "GET").toUpperCase()} ${where} ${Number(status) || 0} ${Number(durMs).toFixed(0)}ms`;
}

export function isSlow(durMs, thresholdMs) {
  return Number.isFinite(durMs) && durMs >= thresholdMs;
}
