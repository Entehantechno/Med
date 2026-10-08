/* ================================================================
   upload.js — Medical image upload (radiology, pathology, histology).
   Files are stored on disk under /uploads and served statically.
   Only teachers/admins may upload.
   ================================================================ */
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authRequired, requireRole } from "../lib/auth.js";
import { db } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Uploaded media lives in the persistent DATA_DIR (outside the code) so it
// survives site upgrades. See lib/paths.js.
import { UPLOADS_DIR, ensureDataDirs, ACADEMIC_DIR } from "../lib/paths.js";
import { uploadDestination, mediaUrlFor, namespaceForUniversity } from "../lib/academic-storage.js";
ensureDataDirs();
export const UPLOAD_DIR = UPLOADS_DIR;

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/x-ms-bmp"]);

const storage = multer.diskStorage({
  destination: uploadDestination,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = "img_" + Date.now() + "_" + Math.round(Math.random() * 1e6) + ext;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.has(ext) && IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

// --- video upload (course lessons) — larger limit, admin/teacher only ---
const VIDEO_ALLOWED = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogg"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg", "application/ogg"]);

function readHead(filePath, n = 512) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(n);
    const len = fs.readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, len);
  } finally { try { fs.closeSync(fd); } catch { /* */ } }
}
function hasImageMagic(filePath, ext) {
  const b = readHead(filePath, 32);
  if ([".jpg", ".jpeg"].includes(ext)) return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === ".png") return b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (ext === ".gif") return b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a";
  if (ext === ".webp") return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  if (ext === ".bmp") return b.subarray(0, 2).toString("ascii") === "BM";
  return false;
}
function hasVideoMagic(filePath, ext) {
  const b = readHead(filePath, 512);
  if ([".mp4", ".mov", ".m4v"].includes(ext)) return b.subarray(4, 8).toString("ascii") === "ftyp";
  if (ext === ".webm") return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  if (ext === ".ogg") return b.subarray(0, 4).toString("ascii") === "OggS";
  return false;
}
function rejectUploaded(file, res, message) {
  try { if (file?.path) fs.unlinkSync(file.path); } catch { /* */ }
  return res.status(400).json({ error: message });
}
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDestination,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "vid_" + Date.now() + "_" + Math.round(Math.random() * 1e6) + ext);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (VIDEO_ALLOWED.has(ext) && VIDEO_MIME.has(file.mimetype)) cb(null, true); else cb(new Error("Unsupported video type"));
  },
});

/* --- PDF upload (competitive reference PDFs) --- */
const PDF_ALLOWED = new Set([".pdf"]);
const PDF_MIME = new Set(["application/pdf"]);
function hasPdfMagic(filePath) {
  const b = readHead(filePath, 8);
  return b.subarray(0, 4).toString("ascii") === "%PDF";
}
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Reference PDFs are global (library + per-question citations). Store under
      // platform/ so they bypass the tenant flat-file gate and are accessible
      // to all students — covers are already global in /covers. Use platform
      // for every role so library is not tenant-sharded.
      const dir = path.join(UPLOAD_DIR, "platform");
      try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch {}
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "pdf_" + Date.now() + "_" + Math.round(Math.random() * 1e6) + ext);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per PDF
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (PDF_ALLOWED.has(ext) && PDF_MIME.has(file.mimetype)) cb(null, true); else cb(new Error("Unsupported PDF type"));
  },
});

/* --- audio upload (virtual-patient auscultation recordings: lung / heart) --- */
const AUDIO_ALLOWED = new Set([".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac"]);
const AUDIO_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/ogg", "audio/opus",
  "audio/aac", "audio/x-aac", "audio/ac3",
]);
function hasAudioMagic(filePath, ext) {
  const b = readHead(filePath, 16);
  if (ext === ".mp3") return (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33)   // ID3
      || (b[0] === 0xff && (b[1] & 0xe6) === 0xe2);                                       // MPEG frame sync
  if (ext === ".wav") return b.subarray(0, 4).toString("ascii") === "RIFF"
      && readHead(filePath, 64).subarray(8, 12).toString("ascii") === "WAVE";
  if ([".ogg", ".opus"].includes(ext)) return b.subarray(0, 4).toString("ascii") === "OggS";
  if ([".m4a", ".aac"].includes(ext)) return (b[4] && b.subarray(4, 8).toString("ascii") === "ftyp")
      || (b[0] === 0xff && (b[1] & 0xf6) === 0xf0);                                       // ADTS frame
  return false;
}
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDestination,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "snd_" + Date.now() + "_" + Math.round(Math.random() * 1e6) + ext);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (AUDIO_ALLOWED.has(ext) && AUDIO_MIME.has(file.mimetype)) cb(null, true); else cb(new Error("Unsupported audio type"));
  },
});

const r = Router();

// Teacher medical media must have an explicit tenant before accepting bytes.
// Reference PDFs have a separate, intentionally public library contract.
function requireMediaUniversity(req, res, next) {
  const universityId = Number(req.user?.university_id);
  if (req.user.role !== "admin" && (!Number.isInteger(universityId) || universityId <= 0)) {
    return res.status(403).json({ error: "university_required" });
  }
  next();
}

/* Optional WebP re-encoding of uploaded images (performance: 30-70% smaller
   raster downloads for the same slide/photo). sharp is a NATIVE, OPTIONAL
   dependency: when it is not installed (restricted build host) the original
   bytes are kept untouched, so uploads never depend on it. Animated GIFs are
   left alone; we only replace the file when WebP is at least 8% smaller. */
let sharpLoader = { mod: undefined, tried: false };
async function loadSharp() {
  if (sharpLoader.tried) return sharpLoader.mod;
  sharpLoader.tried = true;
  try { sharpLoader.mod = (await import("sharp")).default; } catch { sharpLoader.mod = null; }
  return sharpLoader.mod;
}
async function optimizeUploadedImage(file) {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const ext = path.extname(file.filename).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".bmp"].includes(ext)) return null;
  try {
    const outPath = file.path.replace(/\.[^.]+$/, "") + ".webp";
    const buf = await sharp(file.path, { failAfter: 1 })
      .rotate()                      // honour EXIF orientation
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    const orig = fs.statSync(file.path);
    if (buf.length < orig.size * 0.92) {
      fs.writeFileSync(outPath, buf);
      fs.unlinkSync(file.path);
      return path.basename(outPath);
    }
    return null;
  } catch { return null; }
}

// POST /api/upload  (multipart/form-data, field name: "image")
r.post("/", authRequired, requireRole("teacher", "admin"), requireMediaUniversity, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file || !req.file.size) return rejectUploaded(req.file, res, "Empty upload");
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!hasImageMagic(req.file.path, ext)) return rejectUploaded(req.file, res, "Invalid image content");
    let filename = req.file.filename, optimized = false;
    try {
      const webp = await optimizeUploadedImage(req.file);
      if (webp) { filename = webp; optimized = true; }
    } catch { /* keep original */ }
    // Public URL served by express.static below
    res.json({ url: mediaUrlFor(req, filename), name: req.file.originalname, webp: optimized });
  });
});

// POST /api/upload/audio  (multipart/form-data, field name: "audio")
// Lung / heart auscultation recordings for virtual patients.
r.post("/audio", authRequired, requireRole("teacher", "admin"), requireMediaUniversity, (req, res) => {
  audioUpload.single("audio")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file || !req.file.size) return rejectUploaded(req.file, res, "Empty upload");
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!hasAudioMagic(req.file.path, ext)) return rejectUploaded(req.file, res, "Invalid audio content");
    const url = mediaUrlFor(req, req.file.filename);
    res.json({ url, name: req.file.originalname });
  });
});

// POST /api/upload/video  (multipart/form-data, field name: "video")
r.post("/video", authRequired, requireRole("teacher", "admin"), requireMediaUniversity, (req, res) => {
  videoUpload.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file || !req.file.size) return rejectUploaded(req.file, res, "Empty upload");
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!hasVideoMagic(req.file.path, ext)) return rejectUploaded(req.file, res, "Invalid video content");
    res.json({ url: mediaUrlFor(req, req.file.filename), name: req.file.originalname });
  });
});

// POST /api/upload/pdf  (multipart/form-data, field name: "pdf") — competitive reference PDFs
r.post("/pdf", authRequired, requireRole("teacher", "admin"), (req, res) => {
  pdfUpload.single("pdf")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file || !req.file.size) return rejectUploaded(req.file, res, "Empty upload");
    if (!hasPdfMagic(req.file.path)) return rejectUploaded(req.file, res, "Invalid PDF content");
    // Stored under platform/ so library + micro-lesson are globally accessible (bypasses flat gate)
    res.json({ url: `/uploads/platform/${req.file.filename}`, name: req.file.originalname });
  });
});

// --- Central media library: list & manage all uploaded files -------------
// Counts how many flashcards AND virtual-patient cases reference each uploaded
// URL so admins can safely spot (and delete) unused files. Reads every
// data_json once.
function mediaData(raw) {
  try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
function usageMap() {
  const usage = {};
  const bump = (url, refId) => {
    if (!url || typeof url !== "string") return;
    const key = url.split("/").pop();       // match by filename (robust to path)
    if (!key) return;
    (usage[key] ||= new Set()).add(refId);
  };
  const scanMedia = (m, refId) => {
    if (!m) return;
    if (typeof m === "string") bump(m, refId);
    else if (m.url) bump(m.url, refId);
    else if (Array.isArray(m)) m.forEach((x) => scanMedia(x, refId));
  };
  let rows = [];
  try { rows = db.prepare("SELECT id, data_json FROM flashcards").all(); } catch { rows = []; }
  for (const c of rows) {
    const d = mediaData(c.data_json);
    bump(d.image, c.id); bump(d.imageUrl, c.id);
    scanMedia(d.media, c.id);
    scanMedia(d.micro?.media, c.id);
    scanMedia(d.explain?.media, c.id);
    scanMedia(d.mnemonic?.media, c.id);
    bump(d.mnemonic?.image, c.id);
    // Competitive references: each card can have two PDFs (FA+EN) stored in micro
    scanMedia(d.micro?.reference?.pdf_url || d.micro?.reference?.pdfUrl, c.id);
    scanMedia(d.micro?.reference_en?.pdf_url || d.micro?.reference_en?.pdfUrl, c.id);
    scanMedia(d.micro?.reference_fa?.pdf_url || d.micro?.reference_fa?.pdfUrl, c.id);
    if (Array.isArray(d.micro?.references)) for (const r of d.micro.references) scanMedia(r.pdf_url || r.pdfUrl, c.id);
    if (Array.isArray(d.micro?.references)) for (const r of d.micro.references) scanMedia(r.url, c.id);
    scanMedia(d.micro?.reference?.url, c.id);
    scanMedia(d.micro?.reference_en?.url, c.id);
    scanMedia(d.micro?.reference_fa?.url, c.id);
  }
  // Reference catalog PDFs themselves count as in-use when active
  try {
    for (const r of db.prepare("SELECT id, pdf_url, cover_url FROM reference_catalog WHERE pdf_url<>'' OR cover_url<>''").all()) {
      bump(r.pdf_url, `refcat:${r.id}`);
      bump(r.cover_url, `refcat:${r.id}`);
    }
  } catch {}
  // Virtual patients: medical images, orderable-result images, and the
  // lung/heart auscultation recordings (an in-use sound must not be deletable).
  let caseRows = [];
  try { caseRows = db.prepare("SELECT id, data_json FROM cases WHERE active=1").all(); } catch { caseRows = []; }
  const scanCase = (d, refId) => {
    if (!d || typeof d !== "object") return;
    bump(d.lungSound, refId);
    bump(d.heartSound, refId);
    scanMedia(d.images, refId);
    for (const key of ["labResults", "imagingResults", "paraclinicResults"]) {
      if (Array.isArray(d[key])) scanMedia(d[key].map(r => r?.imageUrl).filter(Boolean), refId);
    }
  };
  for (const c of caseRows) scanCase(mediaData(c.data_json), `case${c.id}`);
  // Frozen encounters (including completed history) still need their media
  // after live authoring changes. Counting references does not expose content.
  for (const session of db.prepare("SELECT id, encounter_snapshot_json FROM vp_sessions WHERE encounter_snapshot_json IS NOT NULL").all()) {
    scanCase(mediaData(session.encounter_snapshot_json).caseData, `session${session.id}`);
  }
  return usage;
}

const IMG = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif"]);
const VID = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogv"]);
const AUD = new Set([".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac"]);

// GET /api/upload/library — every uploaded file + kind, size, date, usage count
// Tenant-aware: teachers see only their university namespace; admins see platform + legacy flat.
r.get("/library", authRequired, requireRole("teacher", "admin"), (req, res) => {
  const isAdmin = req.user?.role === "admin";
  let dirs = [];
  let prefixMap = new Map();
  if (isAdmin) {
    // Admin sees both legacy flat (bundled demo + old uploads) and platform (new reference PDFs)
    const flat = UPLOAD_DIR;
    const platform = path.join(UPLOAD_DIR, "platform");
    dirs = [flat, platform];
    prefixMap.set(flat, "/uploads/");
    prefixMap.set(platform, "/uploads/platform/");
  } else {
    const universityId = Number(req.user?.university_id);
    if (!Number.isInteger(universityId) || universityId <= 0) return res.status(403).json({ error: "university_required" });
    const namespace = namespaceForUniversity(universityId);
    const dir = path.join(ACADEMIC_DIR, namespace, "media");
    dirs = [dir];
    prefixMap.set(dir, `/uploads/academic/${namespace}/`);
  }
  const usage = usageMap();
  const seen = new Set();
  const items = [];
  for (const dir of dirs) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch { files = []; }
    for (const f of files) {
      if (f.startsWith(".")) continue;
      if (seen.has(f)) continue; // de-dup by filename (platform shadows flat)
      let st; try { st = fs.statSync(path.join(dir, f)); } catch { continue; }
      if (!st.isFile()) continue;
      const ext = path.extname(f).toLowerCase();
      const kind = IMG.has(ext) ? "image" : AUD.has(ext) ? "audio" : VID.has(ext) ? "video" : (ext === ".pdf" ? "pdf" : "other");
      seen.add(f);
      items.push({
        name: f, url: `${prefixMap.get(dir)}${f}`, kind, ext,
        size: st.size, mtime: st.mtime.toISOString(),
        usedBy: usage[f] ? usage[f].size : 0,
      });
    }
  }
  items.sort((a, b) => b.mtime.localeCompare(a.mtime));
  res.json({ items, total: items.length });
});

// DELETE /api/upload/library/:name — remove a file (blocked if still referenced)
r.delete("/library/:name", authRequired, requireRole("admin"), (req, res) => {
  const name = path.basename(req.params.name || "");   // prevent path traversal
  if (!name || name.startsWith(".")) return res.status(400).json({ error: "bad name" });
  const usage = usageMap();
  if (usage[name] && usage[name].size > 0) {
    return res.status(409).json({ error: "in use", usedBy: usage[name].size });
  }
  // Admin library aggregates flat + platform — try both locations
  const candidates = [path.join(UPLOAD_DIR, name), path.join(UPLOAD_DIR, "platform", name)];
  let found = null;
  for (const p of candidates) {
    const root = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
    if (!(p === UPLOAD_DIR || p.startsWith(root))) continue;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) { found = p; break; }
  }
  if (!found) return res.status(404).json({ error: "not found" });
  try { fs.unlinkSync(found); } catch (e) { return res.status(500).json({ error: e.message }); }
  res.json({ ok: true });
});

export default r;
