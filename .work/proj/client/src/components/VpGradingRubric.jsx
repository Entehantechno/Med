import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { Spinner, useToast } from "./UI.jsx";
import Icon from "./Icon.jsx";

export const VP_SECTIONS = [
  { key: "history", fa: "شرح‌حال", en: "History-taking" },
  { key: "exam", fa: "معاینه فیزیکی", en: "Physical exam" },
  { key: "problem_list", fa: "پرابلم لیست", en: "Problem list" },
  { key: "ddx", fa: "تشخیص افتراقی", en: "Differential diagnosis" },
  { key: "workup", fa: "درخواست پاراکلینیک", en: "Investigations" },
  { key: "diagnosis", fa: "تشخیص نهایی", en: "Final diagnosis" },
  { key: "management", fa: "برنامه درمان", en: "Management" },
  { key: "communication", fa: "ارتباط و حرفه‌ای‌گری", en: "Communication" },
];

const EXTERN_DEFAULT = ["history", "exam", "problem_list", "ddx"];

export function emptyRubric() {
  const internW = {};
  const internSecs = VP_SECTIONS.map((s) => s.key);
  for (const k of internSecs) internW[k] = 1;
  const externW = {};
  for (const k of EXTERN_DEFAULT) externW[k] = 1;
  return {
    version: 1,
    roles: {
      extern: { sections: [...EXTERN_DEFAULT], sectionWeights: externW, weightMode: "items" },
      intern: { sections: internSecs, sectionWeights: internW, weightMode: "items" },
    },
  };
}

export function mergeRubric(raw) {
  const d = emptyRubric();
  if (!raw || typeof raw !== "object") return d;
  const src = raw.roles && typeof raw.roles === "object" ? raw.roles : raw;
  const one = (role, fallback) => {
    const r = src[role] || {};
    const incoming = Array.isArray(r.sections) ? r.sections.filter((k) => VP_SECTIONS.some((s) => s.key === k)) : [];
    const sections = incoming.length ? [...new Set(incoming)] : fallback.sections;
    const srcW = r.sectionWeights || r.weights || {};
    const sectionWeights = {};
    for (const k of sections) {
      const w = Number(srcW[k]);
      sectionWeights[k] = Number.isFinite(w) && w >= 0 ? w : (fallback.sectionWeights[k] ?? 1);
    }
    return {
      sections,
      sectionWeights,
      weightMode: r.weightMode === "sections" ? "sections" : "items",
    };
  };
  return { version: 1, roles: { extern: one("extern", d.roles.extern), intern: one("intern", d.roles.intern) } };
}

function RoleEditor({ role, spec, onChange, t, lang }) {
  const fa = lang === "fa";
  const label = role === "extern" ? t("vpGradingExtern") : t("vpGradingIntern");
  const toggle = (key) => {
    const has = spec.sections.includes(key);
    const sections = has ? spec.sections.filter((k) => k !== key) : [...spec.sections, key];
    const sectionWeights = { ...spec.sectionWeights };
    if (!has && sectionWeights[key] == null) sectionWeights[key] = 1;
    onChange({ ...spec, sections, sectionWeights });
  };
  const setW = (key, v) => {
    const n = Math.max(0, Number(v) || 0);
    onChange({ ...spec, sectionWeights: { ...spec.sectionWeights, [key]: n } });
  };
  return (
    <div className="card" style={{ background: "var(--panel2)" }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        <h4><Icon name="target" size={15} /> {label}</h4>
      </div>
      <div className="field">
        <label>{t("vpGradingWeightMode")}</label>
        <select value={spec.weightMode || "items"} onChange={(e) => onChange({ ...spec, weightMode: e.target.value })}>
          <option value="items">{t("vpGradingModeItems")}</option>
          <option value="sections">{t("vpGradingModeSections")}</option>
        </select>
      </div>
      <div className="small muted mb8">{t("vpGradingSections")}</div>
      {VP_SECTIONS.map((s) => {
        const on = spec.sections.includes(s.key);
        return (
          <div key={s.key} className="toggle-row">
            <label style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={on} onChange={() => toggle(s.key)} style={{ width: 18, height: 18 }} />
              <span>{fa ? s.fa : s.en}</span>
            </label>
            {on && (
              <input type="number" min="0" step="1" value={spec.sectionWeights?.[s.key] ?? 1}
                title={t("vpGradingWeights")}
                style={{ width: 70 }}
                onChange={(e) => setW(s.key, e.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VpGradingRubric({ value, onChange }) {
  const { t, lang } = useApp();
  const r = mergeRubric(value);
  const setRole = (role, spec) => onChange({ ...r, roles: { ...r.roles, [role]: spec } });
  return (
    <div className="grid grid-2">
      <RoleEditor role="extern" spec={r.roles.extern} onChange={(s) => setRole("extern", s)} t={t} lang={lang} />
      <RoleEditor role="intern" spec={r.roles.intern} onChange={(s) => setRole("intern", s)} t={t} lang={lang} />
    </div>
  );
}

export function VpGradingPanel() {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const toast = useToast();
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    api.get("/settings/vp_grading").then((d) => setR(mergeRubric(d))).catch((e) => { setLoadErr(String(e.message || e)); setR({ __err: true }); });
  };
  useEffect(() => { load(); }, []);
  if (r?.__err || loadErr) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{loadErr || (fa ? "بارگذاری ملاک نمره‌دهی شکست خورد" : "Could not load grading settings")}</h3><button className="btn btn-ghost mt16" onClick={() => { setR(null); load(); }}>{fa ? "تلاش دوباره" : "Retry"}</button></div>;
  if (!r) return <Spinner />;
  const save = async () => {
    setBusy(true);
    try {
      await api.put("/settings/vp_grading", r);
      toast(t("saved"));
    } catch (e) { toast(e.message || "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="card">
      <div className="section-title">
        <h4><Icon name="target" size={16} /> {t("vpGrading")}</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setR(emptyRubric())}>{t("vpGradingReset")}</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{t("save")}</button>
        </div>
      </div>
      <p className="small muted mb16">{t("vpGradingHint")}</p>
      <VpGradingRubric value={r} onChange={setR} />
      <div className="small muted mt16">
        {lang === "fa"
          ? "این تنظیم سراسری است. هر کلاس می‌تواند ملاک خودش را جداگانه سفارشی کند. نمره‌های قبلاً ثبت‌شده عوض نمی‌شوند."
          : "This is the university default. Each class can override it. Already-stored scores are never rewritten."}
      </div>
    </div>
  );
}
