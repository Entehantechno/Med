import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Anonymous / stealth ranking settings (opt-in privacy).
   The learner keeps competing and sees their own real rank, but appears under a
   pseudonym to everyone else — pseudonyms cut leaderboard anxiety while keeping
   the motivation. AI-free; gated by the anon_ranking flag; alias pool is admin-set. */
export default function AnonRankingCard() {
  const { t, flag } = useApp();
  const [s, setS] = useState(null);
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!flag("anon_ranking")) return;
    api.get("/learn/anon").then((d) => { setS(d); setAlias(d.alias || ""); }).catch(() => setS(null));
  }, [flag]);

  if (!flag("anon_ranking")) return null;
  if (!s) return null;

  const patch = async (body) => {
    setBusy(true);
    try { const r = await api.put("/learn/anon", body); setS(r); setAlias(r.alias || ""); } catch { /* */ } finally { setBusy(false); }
  };
  const saveAlias = () => patch({ alias });

  return (
    <div className="card set-card anon-card">
      <div className="set-head"><Icon name="lock" size={16} /> {t("anonTitle")}</div>
      <p className="small muted" style={{ marginTop: -2 }}>{t("anonHint")}</p>

      <div className="set-row">
        <div className="set-label">{t("anonEnable")}</div>
        <div className={`switch ${s.enabled ? "on" : ""}`} role="switch" aria-checked={s.enabled}
          aria-label={t("anonEnable")}
          onClick={() => !busy && patch({ enabled: !s.enabled })}><span className="slider" /></div>
      </div>

      {s.enabled && (
        <div className="anon-body">
          <div className="calm-field">
            <label>{t("anonAlias")}</label>
            <div className="anon-alias-row">
              <input type="text" value={alias} maxLength={s.maxAliasLen} disabled={busy}
                placeholder={s.aliasPreview} onChange={(e) => setAlias(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveAlias}>{t("save")}</button>
            </div>
            <div className="small muted">{t("anonAliasHint").replace("{alias}", s.aliasPreview)}</div>
          </div>
          <div className="anon-tip small">👁️‍🗨️ {t("anonReassure")}</div>
        </div>
      )}
    </div>
  );
}
