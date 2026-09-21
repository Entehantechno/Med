import { useEffect, useState, useMemo, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api, getToken } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, useToast } from "../../components/UI.jsx";
import MediaEmbed from "../../components/MediaEmbed.jsx";

/* ---------------------------------------------------------------------------
   MediaLibrary — a central browser for every uploaded file (/uploads). Shows
   kind, size, date and how many cards reference it; lets admins upload new
   files and delete UNUSED ones (in-use files are protected by the server).
   Filter by kind + used/unused + text so a big library stays manageable.
--------------------------------------------------------------------------- */
function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaLibrary() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState("");
  const [usage, setUsage] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null); const vidRef = useRef(null);

  const load = () => api.get("/upload/library").then((d) => setItems(d.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kind && it.kind !== kind) return false;
      if (usage === "used" && it.usedBy === 0) return false;
      if (usage === "unused" && it.usedBy > 0) return false;
      if (needle && !it.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, kind, usage, q]);

  const upload = async (file, isVideo) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append(isVideo ? "video" : "image", file);
      const res = await fetch(isVideo ? "/api/upload/video" : "/api/upload", {
        method: "POST", credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      toast(t("saved")); load();
    } catch (e) { toast(String(e.message)); }
    finally { setBusy(false); if (imgRef.current) imgRef.current.value = ""; if (vidRef.current) vidRef.current.value = ""; }
  };

  const del = async (it) => {
    if (it.usedBy > 0) { toast(t("mediaInUse").replace("{n}", it.usedBy)); return; }
    if (!confirm(t("confirmDelete"))) return;
    try { await api.del(`/upload/library/${encodeURIComponent(it.name)}`); toast(t("saved")); load(); }
    catch (e) { toast(e.message === "HTTP 409" ? t("mediaInUse").replace("{n}", it.usedBy) : e.message); }
  };

  const copyUrl = (url) => { try { navigator.clipboard?.writeText(url); toast(t("copied")); } catch { /* */ } };

  if (!items) return <Spinner />;
  const unusedCount = items.filter((i) => i.usedBy === 0).length;

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="image" size={22} /> {t("mediaLibrary")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0], false)} />
          <input ref={vidRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0], true)} />
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => imgRef.current?.click()}><Icon name="image" size={14} /> {lang === "fa" ? "آپلود تصویر" : "Upload image"}</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => vidRef.current?.click()}><Icon name="play" size={14} /> {lang === "fa" ? "آپلود ویدیو" : "Upload video"}</button>
        </div>
      </div>
      <div className="muted small mb16">{t("mediaLibraryHint")}</div>

      <div className="card lc-filters mb16">
        <div className="lc-filter-grid">
          <label className="field"><span>{t("mediaCol")}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">{t("anyValue")}</option>
              <option value="image">{t("filterMediaImage")}</option>
              <option value="video">{t("filterMediaVideo")}</option>
            </select></label>
          <label className="field"><span>{t("usedIn")}</span>
            <select value={usage} onChange={(e) => setUsage(e.target.value)}>
              <option value="">{t("anyValue")}</option>
              <option value="used">{t("mediaUsed")}</option>
              <option value="unused">{t("mediaUnused")}</option>
            </select></label>
          <label className="field"><span>{t("search")}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} /></label>
        </div>
        <div className="lc-filter-foot">
          <span className="muted small">{t("showingOf").replace("{n}", filtered.length).replace("{total}", items.length)} · {t("mediaUnused")}: {unusedCount}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state"><div className="ico"><Icon name="image" size={40} /></div><h3>{t("mediaEmpty")}</h3></div>
      ) : (
        <div className="media-lib-grid">
          {filtered.map((it) => (
            <div key={it.name} className="media-lib-item card">
              <div className="mli-preview"><MediaEmbed media={{ kind: it.kind, url: it.url }} /></div>
              <div className="mli-name" title={it.name} dir="ltr">{it.name}</div>
              <div className="mli-meta small muted">
                <span>{it.kind === "video" ? "🎞️" : "🖼️"} {fmtSize(it.size)}</span>
                <span dir="ltr">{(it.mtime || "").slice(0, 10)}</span>
              </div>
              <div className="mli-usage small">
                {it.usedBy > 0
                  ? <span className="mli-used">✓ {t("mediaUsedBy").replace("{n}", it.usedBy)}</span>
                  : <span className="mli-unused muted">{t("mediaUnused")}</span>}
              </div>
              <div className="mli-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(it.url)} title={t("copyUrl")}><Icon name="bookmark" size={13} /> {t("copyUrl")}</button>
                <button className={`btn btn-sm ${it.usedBy > 0 ? "btn-ghost" : "btn-danger"}`} disabled={it.usedBy > 0} onClick={() => del(it)} title={it.usedBy > 0 ? t("mediaProtected") : t("delete")}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
