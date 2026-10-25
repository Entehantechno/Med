import { useState, useRef } from "react";
import { useApp } from "../context.jsx";
import { getToken } from "../api.js";
import Icon from "./Icon.jsx";

/* Reusable audio uploader for virtual-patient auscultation recordings
   (lung / heart sounds). Uploads via /api/upload/audio, shows an inline
   player preview, and returns the stored URL via onChange. */
export default function AudioUpload({ value, onChange, label }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/upload/audio", {
        method: "POST", credentials: "same-origin",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      onChange(data.url);
    } catch (e2) {
      setErr(String(e2.message));
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{
          width: 92, height: 92, borderRadius: 12, border: "1px dashed var(--border2)",
          background: "var(--bg2)", overflow: "hidden", display: "grid", placeItems: "center",
          flexShrink: 0, padding: 8,
        }}>
          {value
            ? <Icon name="volume" size={34} />
            : <span style={{ opacity: .4 }}><Icon name="upload" size={30} /></span>}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.aac" onChange={handle} style={{ display: "none" }} />
          {value && <audio controls src={value} preload="metadata" style={{ width: "100%", marginBottom: 8, height: 36 }} />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={pick} disabled={busy}>
              {busy ? "…" : <><Icon name="upload" size={16} /> {t("uploadAudio")}</>}
            </button>
            {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange("")}>{t("removeImage")}</button>}
          </div>
          <input className="mt8" value={value || ""} onChange={(e) => onChange(e.target.value)}
            placeholder={t("orPasteAudioUrl")} style={{ width: "100%", fontSize: ".78rem" }} />
          {err && <div className="err-banner mt8" style={{ margin: 0 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
