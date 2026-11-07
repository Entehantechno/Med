// ---------------------------------------------------------------------------
// medialib.js — media descriptor normalizer for lessons & answer explanations
// ---------------------------------------------------------------------------
// A "media" descriptor attached to a card can be one of:
//   - image : an uploaded image (/uploads/img_*) OR an external https image URL
//   - video : an uploaded video file (/uploads/vid_*) OR an external https .mp4/.webm
//   - embed : an Aparat or YouTube video (we store the raw page/share URL and
//             convert it to a safe player embed URL for an <iframe>)
//
// This module keeps ALL provider parsing in one place so the client just renders
// what it's given, and the CSP frame-src list stays in sync (see security.js).
// No AI, no network calls — pure string parsing.
// ---------------------------------------------------------------------------

// Vetted embed providers. Keep in sync with security.js frameSrc.
export const EMBED_HOSTS = ["aparat.com", "youtube.com", "youtu.be"];

const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?.*)?$/i;
const VID_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i;

function safeHttps(url) {
  // allow same-origin relative uploads and https absolute URLs only
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("/uploads/")) return true;      // our own stored file
  return /^https:\/\//i.test(u);                    // external must be https
}

// --- YouTube: watch?v=, youtu.be/, /embed/, /shorts/ → nocookie embed ---
function youtubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{6,})/i,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  // watch URL with extra params
  try {
    const u = new URL(url);
    if (/youtube\.com$/i.test(u.hostname.replace(/^www\./, "")) && u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
  } catch { /* ignore */ }
  return null;
}

// --- Aparat: aparat.com/v/XXXX  or /video/video/embed/videohash/XXXX/... ---
function aparatHash(url) {
  let m = url.match(/aparat\.com\/v\/([\w-]+)/i);
  if (m) return m[1];
  m = url.match(/aparat\.com\/.*videohash\/([\w-]+)/i);
  if (m) return m[1];
  return null;
}

// Turn a raw provider URL into { provider, embedUrl } or null if unsupported.
export function toEmbed(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  const raw = url.trim();
  const yt = youtubeId(raw);
  if (yt) return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };
  const ap = aparatHash(raw);
  if (ap) return { provider: "aparat", embedUrl: `https://www.aparat.com/video/video/embed/videohash/${ap}/vt/frame` };
  return null;
}

// Detect what kind of media a URL is. Returns "embed" | "video" | "image" | null.
export function detectKind(url) {
  if (!safeHttps(url) && !toEmbed(url)) return null;
  if (toEmbed(url)) return "embed";
  if (VID_EXT.test(url) || /\/uploads\/vid_/.test(url)) return "video";
  if (IMG_EXT.test(url) || /\/uploads\/img_/.test(url)) return "image";
  // an uploaded file with no clear extension → assume image (our uploader always
  // keeps the real extension, so this is just a safety net).
  if (/^\/uploads\//.test(url)) return "image";
  // a bare EXTERNAL https URL with no media extension is most likely a page
  // (e.g. a non-vetted video site). We only trust explicit image/video URLs or
  // the vetted embed providers, so we decline the rest rather than render a
  // broken <img>. Admins can still paste a direct image/mp4 URL.
  return null;
}

// Serialize a stored media object `{ url, kind?, caption_fa?, caption_en?, poster? }`
// into a client-ready descriptor. Returns null if the URL is missing/unsafe.
export function serializeMedia(m, lang = "fa") {
  if (!m) return null;
  const url = (typeof m === "string") ? m : m.url;
  if (!safeHttps(url) && !toEmbed(url || "")) return null;

  const kind = (m && m.kind) || detectKind(url);
  if (!kind) return null;

  const caption = (typeof m === "object")
    ? (lang === "fa" ? (m.caption_fa || m.caption_en) : (m.caption_en || m.caption_fa)) || ""
    : "";

  if (kind === "embed") {
    const e = toEmbed(url);
    if (!e) return null;                 // pasted a non-vetted provider → drop it
    return { kind: "embed", provider: e.provider, url: e.embedUrl, caption };
  }
  if (kind === "video") {
    return { kind: "video", url, poster: (m && m.poster) || "", caption };
  }
  return { kind: "image", url, caption };
}
