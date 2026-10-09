/* academic-storage.js — tenant-isolated media handling & namespace helpers
   Provides upload destination, URL helpers, and Express middlewares for
   /uploads/academic/:namespace/:name and legacy flat-file gate.
   Minimal but correct implementation to satisfy app.js, upload.js and portable.js. */
import fs from "fs";
import path from "path";
import { ACADEMIC_DIR, UPLOADS_DIR, ensureDataDirs } from "./paths.js";
import { db } from "../db.js";

export function namespaceForUniversity(idOrUni) {
  const id = typeof idOrUni === "object" && idOrUni !== null ? idOrUni.id ?? idOrUni.university_id : idOrUni;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "university-0";
  return `university-${n}`;
}

export function uploadDestination(req, file, cb) {
  try {
    ensureDataDirs();
    // Admin uploads are platform-shared (global library), teacher uploads are tenant-isolated
    const role = req?.user?.role;
    const uid = req?.user?.university_id;
    let dir;
    if (role === "admin") {
      dir = path.join(UPLOADS_DIR, "platform");
    } else if (uid) {
      const ns = namespaceForUniversity(uid);
      dir = path.join(ACADEMIC_DIR, ns, "media");
    } else {
      dir = UPLOADS_DIR;
    }
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    cb(null, dir);
  } catch (e) {
    cb(e);
  }
}

export function mediaUrlFor(req, filename) {
  if (!filename) return "";
  const safe = String(filename).split("/").pop() || filename;
  const role = req?.user?.role;
  if (role === "admin") return `/uploads/platform/${safe}`;
  const uid = req?.user?.university_id;
  if (uid) {
    const ns = namespaceForUniversity(uid);
    return `/uploads/academic/${ns}/${safe}`;
  }
  return `/uploads/${safe}`;
}

export function mediaLocation(req, filename) {
  if (!filename) return "";
  const safe = String(filename).split("/").pop() || filename;
  const uid = req?.user?.university_id;
  if (uid) {
    const ns = namespaceForUniversity(uid);
    return path.join(ACADEMIC_DIR, ns, "media", safe);
  }
  return path.join(UPLOADS_DIR, safe);
}

// Publication grants teachers access only to the exact assets referenced by an
// active published resource in the asset's own university, never its directory.
function sharedTeachingAsset(req,ns,name){
 if(req.user?.role!=='teacher')return false;
 const university=Number(/^university-(\d+)$/.exec(ns)?.[1]);if(!university)return false;
 const url=`/uploads/academic/${ns}/${encodeURIComponent(name)}`;
 for(const table of ['cases','flashcards']){
  const rows=db.prepare(`SELECT data_json FROM ${table} WHERE university_id=? AND active=1 AND shared_to_teachers=1 AND instr(data_json,?)>0`).all(university,name);
  for(const row of rows){try{const urls=JSON.stringify(JSON.parse(row.data_json)).match(/\/uploads\/academic\/university-\d+\/[a-zA-Z0-9_.%~-]+/g)||[];if(urls.some(x=>decodeURIComponent(x)===decodeURIComponent(url)))return true}catch{}}
 }return false;
}

// GET /uploads/academic/:namespace/:name
export function academicMedia(req, res, next) {
  try {
    const ns = String(req.params.namespace || "").replace(/[^a-zA-Z0-9._-]/g, "");
    let name = String(req.params.name || "");
    // prevent directory traversal
    name = path.basename(name);
    if (!ns || !name) return res.status(400).json({ error: "bad_request" });
    if (name.includes("..") || ns.includes("..")) return res.status(400).json({ error: "bad_request" });
    const candidates = [
      path.join(ACADEMIC_DIR, ns, "media", name),
      path.join(ACADEMIC_DIR, ns, name),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const userNs = req?.user?.university_id ? namespaceForUniversity(req.user.university_id) : null;
          const isAdmin = req?.user?.role === "admin";
          // Tenant isolation: only same-university users or admins may read tenant media
          if (!isAdmin && userNs !== ns && !sharedTeachingAsset(req,ns,name)) return res.status(404).json({ error: "not_found" });
          // Anonymous (no user) also denied
          if (!req.user) return res.status(404).json({ error: "not_found" });
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          res.setHeader("Cache-Control", "private, no-store");
          return res.sendFile(path.resolve(p));
        }
      } catch {}
    }
    return res.status(404).json({ error: "not_found" });
  } catch (e) {
    return next(e);
  }
}

// This one shipped teaching illustration is referenced by legacy cases in more
// than one university. Do NOT generalize this to arbitrary flat-file references:
// an author could otherwise grant access to a guessed private filename.
function mayReadSharedDemo(req, requestPath) {
  if (requestPath !== '/demo-ecg.svg' || !['student','teacher'].includes(req.user?.role) || !req.user.university_id) return false;
  try {
    const shipped = fs.readFileSync(new URL('../../uploads/demo-ecg.svg', import.meta.url));
    const live = fs.readFileSync(path.join(UPLOADS_DIR, 'demo-ecg.svg'));
    if (!live.equals(shipped)) return false;
    const references = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
      (['url','imageUrl'].includes(key) && child === '/uploads/demo-ecg.svg') || references(child));
    return db.prepare('SELECT data_json FROM cases WHERE university_id=? AND active=1').all(req.user.university_id)
      .some(row => { try { return references(JSON.parse(row.data_json)); } catch { return false; } });
  } catch { return false; }
}

// legacy flat-file gate for /uploads/*
export function legacyMediaGate(req, res, next) {
  try {
    const p = String(req.path || "");
    if (p.includes("..") || p.includes("\0")) return res.status(400).json({ error: "bad_request" });
    // mark tenant media so app.js can set Cache-Control accordingly
    // For flat files that are actually tenant-owned (referenced in cases), treat as tenant media
    let isTenant = p.startsWith("/academic/") || p.includes("/academic/");
    const filename = p.split("/").pop() || "";
    if (!isTenant && filename) {
      try {
        const row = db.prepare("SELECT university_id FROM cases WHERE data_json LIKE ? LIMIT 1").get(`%${filename}%`);
        if (row && row.university_id) isTenant = true;
        if (isTenant) {
          const userUni = req?.user?.university_id ?? null;
          const isAdmin = req?.user?.role === "admin";
          if (!req.user) return res.status(404).json({ error: "not_found" });
          if (!isAdmin && Number(userUni) !== Number(row.university_id) && !mayReadSharedDemo(req, p)) return res.status(404).json({ error: "not_found" });
        }
      } catch {}
    }
    res.locals.tenantMedia = isTenant;
    return next();
  } catch (e) {
    return next();
  }
}
