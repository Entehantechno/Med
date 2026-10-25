import crypto from "crypto";

/** ETag + 304 for poll endpoints (live board, exam leaderboard).
 *  `Cache-Control: private, no-cache` allows revalidation without storing
 *  personalized ranks in a shared cache. Hash `etagParts` only — never a
 *  wall-clock `updatedAt`, or every poll would miss. */
export function sendPrivateJson(req, res, payload, etagParts) {
  const src = typeof etagParts === "string" ? etagParts : JSON.stringify(etagParts);
  const etag = `"${crypto.createHash("sha1").update(src).digest("hex")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, no-cache");
  if (String(req.headers["if-none-match"] || "") === etag) {
    res.status(304).end();
    return true;
  }
  res.json(payload);
  return false;
}

export function sqlInList(ids, cap = 400) {
  const out = [];
  const seen = new Set();
  for (const raw of ids || []) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}
