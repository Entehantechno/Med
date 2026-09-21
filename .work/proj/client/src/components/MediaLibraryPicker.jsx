import { useEffect, useState, useMemo } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { Modal, Spinner } from "./UI.jsx";
import MediaEmbed from "./MediaEmbed.jsx";

/* ---------------------------------------------------------------------------
   MediaLibraryPicker — a modal that lists every already-uploaded file so an
   admin can REUSE an existing image/video in a card instead of re-uploading.
   Calls onPick({ url, kind }) then closes. Filter by kind + name.
--------------------------------------------------------------------------- */
export default function MediaLibraryPicker({ onPick, onClose }) {
  const { t, lang } = useApp();
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/upload/library").then((d) => setItems(d.items)).catch(() => setItems([])); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kind && it.kind !== kind) return false;
      if (needle && !it.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, kind, q]);

  return (
    <Modal title={lang === "fa" ? "انتخاب از کتابخانهٔ رسانه" : "Pick from media library"} onClose={onClose} wide>
      <div className="lc-filter-grid" style={{ marginBottom: 12 }}>
        <label className="field"><span>{t("mediaCol")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("anyValue")}</option>
            <option value="image">{t("filterMediaImage")}</option>
            <option value="video">{t("filterMediaVideo")}</option>
          </select></label>
        <label className="field"><span>{t("search")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} /></label>
      </div>
      {!items ? <Spinner /> : filtered.length === 0 ? (
        <div className="card empty-state"><div className="ico"><Icon name="image" size={36} /></div><h3>{t("mediaEmpty")}</h3></div>
      ) : (
        <div className="media-lib-grid media-pick-grid">
          {filtered.map((it) => (
            <button type="button" key={it.name} className="media-lib-item card media-pick-item"
              onClick={() => { onPick({ url: it.url, kind: it.kind }); onClose(); }}>
              <div className="mli-preview"><MediaEmbed media={{ kind: it.kind, url: it.url }} /></div>
              <div className="mli-name" title={it.name} dir="ltr">{it.name}</div>
              <div className="mli-meta small muted">
                <span>{it.kind === "video" ? "🎞️" : "🖼️"}</span>
                {it.usedBy > 0 ? <span className="mli-used small">✓ {it.usedBy}</span> : <span className="muted small">{t("mediaUnused")}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
