import { useState, useRef } from "react";
import { useApp } from "../context.jsx";
import { getToken } from "../api.js";
import Icon from "./Icon.jsx";

/* Reusable image uploader. Shows a preview and returns the stored URL via onChange. */
export default function ImageUpload({ value, onChange, label, compact = false }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const box = compact ? 56 : 92;

  const pick = () => inputRef.current?.click();

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", {
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
          width: box, height: box, borderRadius: compact ? 10 : 12, border: "1px dashed var(--border2)",
          background: "var(--bg2)", overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {value
            ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ opacity: .4 }}><Icon name="image" size={30} /></span>}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={handle} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={pick} disabled={busy}>
              {busy ? "…" : <><Icon name="upload" size={16} /> {t("uploadImage")}</>}
            </button>
            {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange("")}>{t("removeImage")}</button>}
          </div>
          <input className="mt8" value={value || ""} onChange={(e) => onChange(e.target.value)}
            placeholder={t("orPasteUrl")} style={{ width: "100%", fontSize: ".78rem" }} />
          {err && <div className="err-banner mt8" style={{ margin: 0 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
