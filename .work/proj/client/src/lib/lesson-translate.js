/* lesson-translate.js — show a flashcard's درسنامه in the SITE language.

   The server marks every micro-lesson field that exists only in the other
   language as `pending` (see server/src/lib/lesson-translate.js). This module:
   • asks the server for those fields, up to 8 cards per AI call, batched;
   • stores every translation in the browser cache (IndexedDB, lesson-cache.js),
     keyed by card + target language + SHA-256 of the source text, so a changed
     authored text is never served a stale translation;
   • serves a cached translation with no network call and no AI tokens, which is
     what happens when the learner switches back to a language already seen.

   Authored text in the site language is never replaced: only pending fields are
   filled in. */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { getCachedLesson, putCachedLesson } from "./lesson-cache.js";

const BATCH = 8;            // must match MAX_BATCH on the server
const DEBOUNCE_MS = 60;     // gather cards rendered in the same tick into one request

export const lessonCacheKey = (cardId, to, hash) => `lesson:v1:${cardId}:${to}:${hash}`;

const inflight = new Map(); // key -> Promise (concurrent callers share one request)
const queue = [];           // { key, req, resolve, reject }
let timer = null;

function schedule(ms) {
  if (timer) return;
  timer = setTimeout(flush, ms);
}

function flush() {
  timer = null;
  if (!queue.length) return;
  const to = queue[0].req.to;
  const batch = [];
  for (let i = 0; i < queue.length && batch.length < BATCH;) {
    if (queue[i].req.to === to) batch.push(queue.splice(i, 1)[0]);
    else i += 1;
  }
  const cardIds = batch.map((b) => b.req.cardId);
  api.post("/learn/lessons/translate", { to, cardIds }, { timeoutMs: 60_000, stage: "translate" })
    .then(async (r) => {
      for (const b of batch) {
        const fields = r?.translations?.[b.req.cardId];
        const hash = r?.hashes?.[b.req.cardId];
        if (fields && hash === b.req.hash) {
          await putCachedLesson(b.key, fields);
          b.resolve(fields);
        } else {
          b.reject(new Error("translation_failed"));
        }
      }
    })
    .catch((err) => batch.forEach((b) => b.reject(err)));
  if (queue.length) schedule(0); // remaining cards go out in the next request
}

/* Resolves to the translated fields of one pending micro-lesson
   ({ lead?, golden?, points?, options?, source? }) — from the cache when possible. */
export async function loadLessonFields(req) {
  const key = lessonCacheKey(req.cardId, req.to, req.hash);
  const hit = await getCachedLesson(key);
  if (hit && typeof hit === "object") return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = new Promise((resolve, reject) => {
    queue.push({ key, req, resolve, reject });
    schedule(DEBOUNCE_MS);
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* Put translated fields into a micro-lesson. Only pending fields change. */
export function applyLessonFields(micro, fields) {
  if (!micro || !fields || !micro.pending) return micro;
  const out = { ...micro, pending: null };
  for (const k of micro.pending.fields || []) {
    if (fields[k] !== undefined) out[k] = fields[k];
  }
  return out;
}

/* One card's micro-lesson: { micro (with pending fields applied when ready), status }.
   status: "idle" (nothing pending or not enabled) | "loading" | "ready" | "failed". */
export function useLessonFields(micro, enabled = true) {
  const pending = micro?.pending || null;
  const key = pending && enabled ? lessonCacheKey(pending.cardId, pending.to, pending.hash) : "";
  const [st, setSt] = useState({ key: "", status: "idle", fields: null });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    setSt({ key, status: "loading", fields: null });
    loadLessonFields(pending).then(
      (f) => { if (alive) setSt({ key, status: "ready", fields: f }); },
      () => { if (alive) setSt({ key, status: "failed", fields: null }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { micro, status: "idle" };
  if (st.key !== key) return { micro, status: "loading" };
  if (st.status === "ready") return { micro: applyLessonFields(micro, st.fields), status: "ready" };
  return { micro, status: st.status };
}

/* Several pending requests (summary bullets, mind-map labels). Returns a map
   cardId -> { status, fields }. */
export function useLessonTranslations(reqs, enabled = true) {
  const sig = enabled ? (reqs || []).map((r) => lessonCacheKey(r.cardId, r.to, r.hash)).join("|") : "";
  const [st, setSt] = useState({ sig: "", map: {} });
  useEffect(() => {
    if (!sig) return undefined;
    let alive = true;
    const out = {};
    Promise.all(reqs.map((r) => loadLessonFields(r).then(
      (f) => { out[r.cardId] = { status: "ready", fields: f }; },
      () => { out[r.cardId] = { status: "failed", fields: null }; },
    ))).then(() => { if (alive) setSt({ sig, map: out }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  if (!sig) return {};
  if (st.sig !== sig) {
    const loading = {};
    for (const r of reqs) loading[r.cardId] = { status: "loading", fields: null };
    return loading;
  }
  return st.map;
}

const fieldText = (fields, kind) => {
  if (!fields) return "";
  if (kind === "points0") return (fields.points || [])[0] || "";
  return fields[kind] || "";
};

/* Summary bullets: native items as they are; pending items once translated.
   Same order and the same golden > lead > first-point rule as the server. */
export function resolveSummaryBullets(items, byCard) {
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    let text = it.text;
    if (it.pending) {
      const got = byCard?.[it.cardId];
      if (!got || got.status !== "ready") continue;
      text = fieldText(got.fields, it.field);
    }
    const t = String(text || "").trim();
    const k = t.replace(/\s+/g, " ").toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 12);
}

export function summaryLoading(items, byCard) {
  return (items || []).some((it) => it.pending && (!byCard?.[it.cardId] || byCard[it.cardId].status === "loading"));
}

/* Mind-map: pending children (label null) take their text from the translation. */
export function resolveMindmapLabels(map, byCard) {
  if (!map || !Array.isArray(map.branches)) return map;
  const branches = map.branches.map((b) => ({
    ...b,
    children: (b.children || []).map((c) => {
      if (!c.pending) return c;
      const got = byCard?.[c.cardId];
      if (!got || got.status !== "ready") return { ...c, label: null, loading: got?.status !== "failed", failed: got?.status === "failed" };
      const f = got.fields || {};
      const label = c.field === "points" ? (f.points || [])[c.index] : f.golden;
      return label ? { ...c, pending: false, label } : { ...c, label: null, failed: true };
    }),
  }));
  return { ...map, branches };
}

export function mindmapRequests(map) {
  const seen = new Map();
  for (const b of map?.branches || []) for (const c of b.children || []) {
    if (c.pending && !seen.has(c.cardId)) seen.set(c.cardId, { cardId: c.cardId, to: c.to, hash: c.hash, fields: [c.field] });
    else if (c.pending) seen.get(c.cardId).fields.push(c.field);
  }
  return [...seen.values()];
}

/* The mind-map as shown: pending labels filled from the translations. */
export function useMindmapView(map) {
  const reqs = useMemo(() => mindmapRequests(map), [map]);
  const byCard = useLessonTranslations(reqs, reqs.length > 0);
  return useMemo(() => resolveMindmapLabels(map, byCard), [map, byCard]);
}
