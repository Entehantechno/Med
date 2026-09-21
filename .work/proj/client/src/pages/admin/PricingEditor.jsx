import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, useToast } from "../../components/UI.jsx";

/* Admin edits subscription plan prices (stored in Rial, shown in Toman). */
export default function PricingEditor() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/pricing").then(setF).catch(() => setF({ monthly: 990000, yearly: 7900000, monthlyDays: 30, yearlyDays: 365 })); }, []);
  if (!f) return <Spinner />;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toman = (r) => (Number(r) / 10 || 0).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
  const save = async () => {
    setBusy(true);
    try { const r = await api.put("/admin/pricing", f); setF(r); toast(t("saved")); } finally { setBusy(false); }
  };
  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="crown" size={22} /> {t("pricingEditor")}</h2>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}><Icon name="check" size={14} /> {t("save")}</button>
      </div>
      <div className="muted small mb16">{t("pricingEditorHint")}</div>
      <div className="card mb16">
        <h4 className="mb8">{t("monthly")}</h4>
        <div className="grid grid-2">
          <div className="field"><label>{t("priceRial")}</label><input type="number" value={f.monthly} onChange={(e) => set("monthly", e.target.value)} /><div className="small muted mt8">= {toman(f.monthly)} {t("toman")}</div></div>
          <div className="field"><label>{t("durationDays")}</label><input type="number" value={f.monthlyDays} onChange={(e) => set("monthlyDays", e.target.value)} /></div>
        </div>
      </div>
      <div className="card">
        <h4 className="mb8">{t("yearly")}</h4>
        <div className="grid grid-2">
          <div className="field"><label>{t("priceRial")}</label><input type="number" value={f.yearly} onChange={(e) => set("yearly", e.target.value)} /><div className="small muted mt8">= {toman(f.yearly)} {t("toman")}</div></div>
          <div className="field"><label>{t("durationDays")}</label><input type="number" value={f.yearlyDays} onChange={(e) => set("yearlyDays", e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}
