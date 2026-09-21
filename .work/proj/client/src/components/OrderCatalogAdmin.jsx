import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { Spinner, useToast } from "./UI.jsx";
import Icon from "./Icon.jsx";

/* Teacher/admin editor for the shared VP lab + imaging option list.
   Students and case authors pick from these same options. */
function Editor({ kind, title, d, setD, t }) {
  const rows = d[kind] || [];
  const setRows = (next) => setD((s) => ({ ...s, [kind]: next }));
  return (
    <div className="card mb16">
      <div className="section-title">
        <h4>{title} <span className="tag">{rows.length}</span></h4>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRows([...rows, { fa: "", en: "", aliases: [] }])}>+ {t("add")}</button>
      </div>
      {rows.map((r, i) => (
        <div className="inline-form mt8" key={i} style={{ alignItems: "center" }}>
          <input placeholder="FA" value={r.fa || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, fa: e.target.value } : x))} />
          <input placeholder="EN" value={r.en || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
          <input placeholder={t("resultAliases")} value={(r.aliases || []).join(", ")}
            onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x))} />
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {!rows.length && <div className="small muted">{t("noneYet")}</div>}
    </div>
  );
}

export default function OrderCatalogAdmin() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/order-catalog").then(setD).catch((e) => { setLoadErr(String(e.message || e)); setD({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.put("/order-catalog", d);
      setD({ labs: saved.labs, imaging: saved.imaging, paraclinic: saved.paraclinic || [] });
      toast(t("saved"));
    } catch (e) {
      toast(e?.message || t("errorGeneric"));
    } finally { setBusy(false); }
  };
  if (d?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری فهرست سفارش شکست خورد" : "Could not load the order catalog")}</h3><button className="btn btn-ghost mt16" onClick={() => { setD(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!d) return <Spinner />;
  return (
    <div className="card mt16">
      <div className="section-title">
        <h4><Icon name="flask" size={16} /> {t("orderCatalogTitle")}</h4>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{t("save")}</button>
      </div>
      <div className="small muted mb16">{t("orderCatalogHint")}</div>
      <Editor kind="labs" title={fa ? "آزمایش‌های قابل درخواست" : "Orderable lab tests"} d={d} setD={setD} t={t} />
      <Editor kind="paraclinic" title={fa ? "پاراکلینیک قابل درخواست (ECG، PFT، EEG…)" : "Orderable paraclinical studies (ECG, PFT, EEG…)"} d={d} setD={setD} t={t} />
      <Editor kind="imaging" title={fa ? "تصویربرداری قابل درخواست" : "Orderable imaging studies"} d={d} setD={setD} t={t} />
    </div>
  );
}
