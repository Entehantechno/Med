/* sitecontent.js — Lightweight headless-CMS for editable site copy.
   Follows the COPE principle (Create Once, Publish Everywhere): all editable
   text lives as a single JSON key-value blob in `settings` under "site_content".
   The public site (e.g. the Landing page, shown to logged-out visitors) reads
   it WITHOUT auth; only an admin can write. Any key the admin hasn't overridden
   falls back to the built-in i18n string on the client. */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";

const r = Router();
const KEY = "site_content";

function readContent() {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(KEY);
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}
function writeContent(obj) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(KEY, JSON.stringify(obj || {}));
  persistNow();
}

/* Public: anyone (even logged-out) can read the published copy. */
r.get("/", (req, res) => {
  res.json({ content: readContent() });
});

/* Admin: overwrite the whole content map (simple + predictable). */
r.put("/", authRequired, requireRole("admin"), (req, res) => {
  const content = req.body && typeof req.body.content === "object" ? req.body.content : {};
  // keep only string values, trim empties so they fall back to i18n
  const clean = {};
  for (const [k, v] of Object.entries(content)) {
    if (typeof v === "string" && v.trim() !== "") clean[k] = v;
  }
  writeContent(clean);
  res.json({ ok: true, count: Object.keys(clean).length });
});

/* Admin: reset everything back to i18n defaults (clears overrides). */
r.delete("/", authRequired, requireRole("admin"), (req, res) => {
  writeContent({});
  res.json({ ok: true });
});

/* ----------------------------------------------------------------
   PUBLIC site config — readable by anyone (even logged-out) so the
   Landing page & shell can react: maintenance mode, promo banner,
   store-enabled, and the available learning programs.
   ---------------------------------------------------------------- */
function getSettingJson(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  try { return row ? JSON.parse(row.value) : fallback; } catch { return fallback; }
}

r.get("/config", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  const maintenance = getSettingJson("maintenance", { on: false, title_fa: "", title_en: "", body_fa: "", body_en: "" });
  const banner = getSettingJson("landing_banner", { on: false });
  // store enabled = feature flag "store" (default on if the flag row is missing)
  let storeEnabled = true;
  try {
    const { isEnabled } = await import("../lib/flags.js");
    storeEnabled = isEnabled("store");
  } catch { /* */ }
  let programs = [];
  try {
    const { activePrograms } = await import("../lib/programs.js");
    programs = activePrograms(req.query.lang === "en" ? "en" : "fa");
  } catch { /* */ }
  const mascots = getSettingJson("mascots", null) || defaultMascots();
  res.json({ maintenance, banner, storeEnabled, programs, mascots });
});

/* ----------------------------------------------------------------
   Learning-path MASCOTS config — the character cast (Dr. Med + the
   Microbe boss). Admin-editable: image, on/off, animation speed, and
   the rotating speech lines per phase. Read publicly so the learner
   client can render + animate them; written by admin only.
   ---------------------------------------------------------------- */
function defaultMascots() {
  return {
    enabled: true,
    speed: "normal",             // slow | normal | fast — animation tempo
    dr: {
      enabled: true,
      img: "/mascots/dr-med.webp",
      guides: ["/mascots/dr-med.webp", "/mascots/dr-nova.webp", "/mascots/organ-heart.webp", "/mascots/organ-brain.webp"],
      lines: {
        // rotating lines per phase (client picks deterministically per section)
        start: {
          fa: ["بزن بریم! اولین قدم همیشه مهم‌ترینه.", "آماده‌ای؟ با هم این بخش رو فتح می‌کنیم.", "هر درس یه قدم به پزشکِ بهتر شدن نزدیک‌ترت می‌کنه."],
          en: ["Let's go! The first step matters most.", "Ready? Let's conquer this section together.", "Every lesson makes you a better doctor."],
        },
        mid: {
          fa: ["عالی پیش می‌ری! همین‌طور ادامه بده.", "نصف راه رو اومدی — عالیه!", "تمرکزت رو نگه دار، داری حرفه‌ای می‌شی."],
          en: ["You're doing great — keep it up!", "Halfway there. Excellent!", "Stay focused, you're becoming a pro."],
        },
        done: {
          fa: ["این بخش رو کامل کردی! بهت افتخار می‌کنم.", "آفرین! یه فصل دیگه از دانشت کامل شد.", "کارت عالی بود — استراحت کوتاه، بعد بخش بعدی!"],
          en: ["You finished this section! So proud of you.", "Nice! Another chapter of knowledge complete.", "Great work — short break, then the next section!"],
        },
      },
    },
    microbe: {
      enabled: true,
      img: "/mascots/microbe.webp",
      lines: {
        fa: ["فکر کردی می‌تونی از پسم بربیای؟", "این چالش رو رد کنی تا باور کنم!", "بذار ببینم چقدر بلدی…"],
        en: ["Think you can beat me?", "Pass this challenge — if you can!", "Let's see what you've got…"],
      },
    },
  };
}

// Public read (learner client). Falls back to built-in defaults.
r.get("/mascots", (req, res) => {
  res.json({ mascots: getSettingJson("mascots", null) || defaultMascots() });
});

// Admin write — merge the posted config over defaults, then persist.
r.put("/mascots", authRequired, requireRole("admin"), (req, res) => {
  const body = req.body && typeof req.body.mascots === "object" ? req.body.mascots : {};
  const base = getSettingJson("mascots", null) || defaultMascots();
  // shallow-merge top level + nested dr/microbe so partial saves are safe
  const next = { ...base, ...body };
  if (body.dr) next.dr = { ...base.dr, ...body.dr, lines: body.dr.lines || base.dr.lines };
  if (body.microbe) next.microbe = { ...base.microbe, ...body.microbe, lines: body.microbe.lines || base.microbe.lines };
  if (!["slow", "normal", "fast"].includes(next.speed)) next.speed = "normal";
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run("mascots", JSON.stringify(next));
  persistNow();
  res.json({ ok: true, mascots: next });
});

// Admin reset to defaults.
r.delete("/mascots", authRequired, requireRole("admin"), (req, res) => {
  db.prepare("DELETE FROM settings WHERE key=?").run("mascots");
  persistNow();
  res.json({ ok: true, mascots: defaultMascots() });
});

/* ----------------------------------------------------------------
   PUBLIC social-proof payload for the Landing page — real live stats,
   published testimonials, trust badges & FAQ. Readable by anyone.
   ---------------------------------------------------------------- */
r.get("/landing", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  const lang = req.query.lang === "en" ? "en" : "fa";
  try {
    const { publicLanding } = await import("../lib/landing.js");
    res.json(publicLanding(lang));
  } catch (e) {
    res.json({ stats: null, testimonials: [], faqs: [], badges: [] });
  }
});

/* -------------------- PUBLIC BLOG (no auth — for SEO/traffic) -------------- */
// Gated by the `blog` feature flag (default on). List of published posts.
r.get("/blog", async (req, res) => {
  try {
    const { isEnabled } = await import("../lib/flags.js");
    if (!isEnabled("blog")) return res.json({ enabled: false, posts: [], categories: [] });
    const { listPosts, listCategories, publishScheduled } = await import("../lib/blog.js");
    publishScheduled();   // auto-publish any posts whose scheduled time has arrived
    const lang = req.query.lang === "en" ? "en" : "fa";
    const category = req.query.category || null;
    const tag = req.query.tag || null;
    res.json({ enabled: true, posts: listPosts({ lang, category, tag }), categories: listCategories() });
  } catch (e) { res.json({ enabled: true, posts: [], categories: [] }); }
});
// Single post by slug (increments views).
r.get("/blog/:slug", async (req, res) => {
  try {
    const { isEnabled } = await import("../lib/flags.js");
    if (!isEnabled("blog")) return res.status(404).json({ error: "not found" });
    const { getPost } = await import("../lib/blog.js");
    const lang = req.query.lang === "en" ? "en" : "fa";
    const post = getPost(req.params.slug, lang);
    if (!post) return res.status(404).json({ error: "not found" });
    res.json(post);
  } catch (e) { res.status(404).json({ error: "not found" }); }
});

/* -------------------- PUBLIC CERTIFICATE VERIFICATION (no auth) ------------ */
// Anyone (employer, school) can verify a certificate by its serial code.
r.get("/verify/:serial", async (req, res) => {
  try {
    const { verify } = await import("../lib/certificates.js");
    const lang = req.query.lang === "en" ? "en" : "fa";
    res.json(verify(req.params.serial, lang));
  } catch (e) { res.json({ valid: false }); }
});

export default r;
