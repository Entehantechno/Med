/* Structural admin changes are language-agnostic: one path, one bank.
   Deleting a lesson in the FA panel must not let the next bank import
   recreate it when the admin later opens the EN panel (or after a restart). */
import { db, persistNow } from "../db.js";

export function fillPair(fa, en) {
  const a = String(fa ?? "").trim();
  const b = String(en ?? "").trim();
  return { fa: a || b, en: b || a };
}

export function pickTitle(lang, fa, en) {
  return (lang === "en" ? (en || fa) : (fa || en)) || "";
}

function keyOf(kind, key) {
  return `${kind}:${String(key || "").trim()}`;
}

export function tombstone(kind, key) {
  const k = String(key || "").trim();
  if (!k) return;
  db.prepare(
    `INSERT INTO admin_deleted (kind, key, created_at) VALUES (?,?,datetime('now'))
     ON CONFLICT(kind, key) DO UPDATE SET created_at=excluded.created_at`
  ).run(kind, k);
}

export function isTombstoned(kind, key) {
  const k = String(key || "").trim();
  if (!k) return false;
  return !!db.prepare("SELECT 1 AS n FROM admin_deleted WHERE kind=? AND key=?").get(kind, k);
}

export function tombstoneNode(node, topic) {
  if (!node) return;
  const slug = topic?.slug || "";
  tombstone("node", String(node.id));
  if (slug && node.title_fa) tombstone("node", `${slug}:${node.title_fa}`);
  if (slug && node.title_en) tombstone("node", `${slug}:${node.title_en}`);
}

export function tombstoneTopic(topic) {
  if (!topic) return;
  tombstone("topic", String(topic.id));
  if (topic.slug) tombstone("topic", topic.slug);
}

export function tombstoneCard(cardRow) {
  if (!cardRow) return;
  tombstone("card", String(cardRow.id));
  let d = {};
  try { d = JSON.parse(cardRow.data_json || "{}"); } catch { d = {}; }
  const fp = d.source_meta?.fingerprint;
  if (fp) tombstone("card", fp);
}

export function nodeIsTombstoned(topic, title_fa, title_en, nodeId) {
  if (nodeId && isTombstoned("node", String(nodeId))) return true;
  const slug = topic?.slug || "";
  if (slug && title_fa && isTombstoned("node", `${slug}:${title_fa}`)) return true;
  if (slug && title_en && isTombstoned("node", `${slug}:${title_en}`)) return true;
  return false;
}

export function topicIsTombstoned(topicOrSlug) {
  if (!topicOrSlug) return false;
  if (typeof topicOrSlug === "string") return isTombstoned("topic", topicOrSlug);
  return isTombstoned("topic", String(topicOrSlug.id)) || isTombstoned("topic", topicOrSlug.slug);
}

export function cardIsTombstoned(idOrFingerprint) {
  return isTombstoned("card", String(idOrFingerprint || ""));
}

export function persistAdminDeleted() {
  persistNow();
}

export { keyOf };
