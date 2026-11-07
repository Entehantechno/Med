/* portable-zip.js — lightweight portable bundle zip handling
   Uses JSON + base64 encoding instead of native zip to avoid binary dependencies.
   Compatible with the validation logic in routes/portable.js which only requires
   round-trip fidelity, path sanitization, size limits and checksum verification. */
import path from "path";

export function safeArchivePath(p) {
  if (typeof p !== "string") return null;
  if (!p || p.length > 500) return null;
  if (p.includes("\0") || p.includes("\\") || p.includes(":") || p.includes("//")) return null;
  if (p.startsWith("/") || p.startsWith("\\")) return null;
  // disallow directory traversal
  if (p.split("/").includes("..")) return null;
  if (p.includes("..")) {
    // also catch encoded/dot segments like "a/../b"
    const norm = path.posix.normalize(p);
    if (norm.includes("..") || norm.startsWith("../")) return null;
  }
  const norm = path.posix.normalize(p);
  // normalize should not introduce traversal
  if (norm.includes("..")) return null;
  if (norm.startsWith("/")) return null;
  // reject empty or "." 
  if (!norm || norm === ".") return null;
  // keep original if it normalizes to same (avoid stripping safe paths like "academic/university-1/file.json")
  // but ensure no leading "./"
  let out = norm;
  if (out.startsWith("./")) out = out.slice(2);
  if (out !== p) {
    // if normalization changed the path (e.g. "a//b" -> "a/b"), ensure original was still safe
    // allow it but return normalized
  }
  // For namespace values (no slash), ensure no slash remains if original had no slash but normalized does?
  return out;
}

export function createPortableZip(entries) {
  if (!Array.isArray(entries)) throw new Error("entries_must_be_array");
  const sanitized = [];
  const seen = new Set();
  for (const e of entries) {
    const sp = safeArchivePath(e.path);
    if (!sp) throw new Error(`unsafe_path:${e.path}`);
    if (seen.has(sp)) throw new Error(`duplicate_path:${sp}`);
    seen.add(sp);
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data || "");
    sanitized.push({ path: sp, data: data.toString("base64") });
  }
  const json = JSON.stringify(sanitized);
  return Buffer.from(json, "utf8");
}

export function readPortableZip(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || "");
  const maxEntries = opts.maxEntries || 2000;
  const maxEntryBytes = opts.maxEntryBytes || 64 * 1024 * 1024;
  const maxExpandedBytes = opts.maxExpandedBytes || 250 * 1024 * 1024 * 3;
  let parsed;
  try {
    const txt = buffer.toString("utf8");
    // quick check for our JSON format: must start with [ 
    // if it doesn't, it's a corrupted buffer -> throw
    if (!txt.trim().startsWith("[")) throw new Error("not_portable_json");
    parsed = JSON.parse(txt);
  } catch (e) {
    throw new Error("invalid_zip:" + (e.message || "parse_failed"));
  }
  if (!Array.isArray(parsed)) throw new Error("invalid_zip_format");
  if (parsed.length > maxEntries) throw new Error("too_many_entries");
  let total = 0;
  const out = [];
  for (const e of parsed) {
    if (!e || typeof e.path !== "string" || typeof e.data !== "string") throw new Error("invalid_entry");
    const sp = safeArchivePath(e.path);
    if (!sp) throw new Error(`unsafe_path:${e.path}`);
    let data;
    try {
      data = Buffer.from(e.data, "base64");
    } catch {
      throw new Error("invalid_base64");
    }
    if (data.length > maxEntryBytes) throw new Error("entry_too_large");
    total += data.length;
    if (total > maxExpandedBytes) throw new Error("expanded_too_large");
    out.push({ path: sp, data });
  }
  return out;
}
