import { useState, useRef } from "react";
import { useApp } from "../context.jsx";
import { getToken } from "../api.js";
import Icon from "./Icon.jsx";
import MediaEmbed from "./MediaEmbed.jsx";
import MediaLibraryPicker from "./MediaLibraryPicker.jsx";

/* ---------------------------------------------------------------------------
   MediaUpload — reusable admin control to attach an IMAGE or a VIDEO to a card
   block (question / درسنامه / پاسخنامه / mnemonic). Supports:
     • uploading an image file            → POST /api/upload
     • uploading a video file (mp4/webm)  → POST /api/upload/video
     • pasting a direct image/video URL   (external https)
     • pasting an Aparat / YouTube link   → rendered as a safe embed
   The value is a small object: { url, kind, caption_fa }. It normalizes the
   kind locally so the admin sees a live preview immediately; the server
   re-validates on save (medialib.js) — untrusted providers are dropped.
--------------------------------------------------------------------------- */

const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?.*)?$/i;
const VID_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i;
function detect(url) {
  if (!url) return null;
  if (/aparat\.com|youtube\.com|youtu\.be/i.test(url)) return "embed";
  if (VID_EXT.test(url) || /\/uploads\/vid_/.test(url)) return "video";
  if (IMG_EXT.test(url) || /\/uploads\/img_/.test(url)) return "image";
  if (/^\/uploads\//.test(url)) return "image";
  return "image";
}
// build a client-side preview descriptor mirroring the server's serializeMedia
function previewOf(url, caption) {
  if (!url) return null;
  const kind = detect(url);
  if (kind === "embed") {
    let embed = url;
    const yt = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/i);
    if (yt) embed = `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const ap = url.match(/aparat\.com\/v\/([\w-]+)/i) || url.match(/videohash\/([\w-]+)/i);
    if (ap) embed = `https://www.aparat.com/video/video/embed/videohash/${ap[1]}/vt/frame`;
    return { kind: "embed", url: embed, caption };
  }
  return { kind, url, caption };
}

export default function MediaUpload({ value, onChange, label }) {
  const { t, lang } = useApp();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const imgRef = useRef(null);
  const vidRef = useRef(null);
  const [picking, setPicking] = useState(false);
  const v = value || {};

  const setUrl = (url) => onChange({ ...v, url, kind: detect(url) });
  const setCaption = (caption_fa) => onChange({ ...v, caption_fa });
  const clear = () => onChange({ url: "", kind: null, caption_fa: v.caption_fa || "" });

  const doUpload = async (file, kind) => {
    setErr(""); setBusy(kind);
    try {
      const fd = new FormData();
      fd.append(kind === "video" ? "video" : "image", file);
      const res = await fetch(kind === "video" ? "/api/upload/video" : "/api/upload", {
        method: "POST", credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      onChange({ ...v, url: data.url, kind });
    } catch (e) { setErr(String(e.message)); }
    finally { setBusy(""); if (imgRef.current) imgRef.current.value = ""; if (vidRef.current) vidRef.current.value = ""; }
  };

  const preview = previewOf(v.url, lang === "fa" ? v.caption_fa : v.caption_fa);

  return (
    <div className="field media-upload">
      {label && <label>{label}</label>}
      <div className="media-upload-row">
        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0], "image")} />
        <input ref={vidRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0], "video")} />
        <button type="button" className="btn btn-sm btn-primary" onClick={() => imgRef.current?.click()} disabled={!!busy}>
          {busy === "image" ? "…" : <><Icon name="image" size={15} /> {lang === "fa" ? "آپلود تصویر" : "Upload image"}</>}
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => vidRef.current?.click()} disabled={!!busy}>
          {busy === "video" ? "…" : <><Icon name="play" size={15} /> {lang === "fa" ? "آپلود ویدیو" : "Upload video"}</>}
        </button>
        <button type="button" className="btn btn-sm btn-ghost media-pick-btn" onClick={() => setPicking(true)}>
          <Icon name="image" size={15} /> {lang === "fa" ? "انتخاب از کتابخانه" : "Pick from library"}
        </button>
        {v.url && <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>{lang === "fa" ? "حذف" : "Remove"}</button>}
      </div>
      {picking && <MediaLibraryPicker onClose={() => setPicking(false)}
        onPick={({ url, kind }) => onChange({ ...v, url, kind })} />}
      <input className="mt8 media-url-input" value={v.url || ""} onChange={(e) => setUrl(e.target.value)}
        placeholder={lang === "fa" ? "یا لینک تصویر / mp4 / آپارات / یوتیوب را بچسبان" : "or paste image / mp4 / Aparat / YouTube link"} />
      <input className="mt8 media-cap-input" value={v.caption_fa || ""} onChange={(e) => setCaption(e.target.value)}
        placeholder={lang === "fa" ? "زیرنویس (اختیاری)" : "Caption (optional)"} />
      {err && <div className="err-banner mt8" style={{ margin: 0 }}>{err}</div>}
      {preview && (
        <div className="media-upload-preview mt8">
          <div className="small muted mb8">{lang === "fa" ? "پیش‌نمایش:" : "Preview:"}</div>
          <MediaEmbed media={preview} />
        </div>
      )}
    </div>
  );
}
