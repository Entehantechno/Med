/* PasswordCard.jsx — the password block on the admin user profile.
   Any staff member who can reset a user can set a new password. Only a full admin
   (canReveal) can see the current one; the server audits every reveal. The shown
   password hides itself after 30 seconds. */
import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { useToast } from "./UI.jsx";
import Icon from "./Icon.jsx";
import { passwordErrorText } from "../lib/password-errors.js";

const SHOW_MS = 30000;

export default function PasswordCard({ userId, initial, canReveal, onSaved }) {
  const { t } = useApp();
  const toast = useToast();
  const [shown, setShown] = useState(null);   // { available, stale, password } from the server
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [next, setNext] = useState("");

  // Forget a revealed password when the page changes user, and hide it after a while.
  useEffect(() => { setShown(null); setNext(""); }, [userId]);
  useEffect(() => {
    if (!shown?.password) return undefined;
    const timer = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  const reveal = async () => {
    setBusy(true);
    try { setShown(await api.get(`/admin/users/${userId}/credentials`)); }
    catch (e) { toast(passwordErrorText(e, t)); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the password stays visible to copy by hand */ }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!next) { toast(t("pwCardNeedPw")); return; }
    try {
      await api.post(`/admin/users/${userId}/password`, { password: next });
      setNext(""); setShown(null);
      toast(t("saved"));
      onSaved?.();
    } catch (err) { toast(passwordErrorText(err, t)); }
  };

  const status = shown
    ? (shown.available ? null : (shown.stale ? t("pwCardStale") : t("pwCardUnavailable")))
    : null;

  return (
    <section className="card" aria-labelledby="pw-card-title" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <h4 id="pw-card-title" style={{ margin: 0 }}><Icon name="key" size={16} /> {t("pwCardTitle")}</h4>
        <span className="tag">{(shown ? shown.initial : initial) ? t("pwCardInitial") : t("pwCardChosen")}</span>
      </div>

      {canReveal && (
        <div style={{ display: "grid", gap: 8 }}>
          {!shown?.password && (
            <div>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={reveal}>
                <Icon name="eye" size={13} /> {t("pwCardShow")}
              </button>
              <div className="small muted" style={{ marginTop: 6 }}>{t("pwCardAuto")}</div>
            </div>
          )}
          {shown?.password && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <code dir="ltr" data-testid="shown-password" style={{ fontSize: 16, padding: "6px 10px", borderRadius: 8, background: "var(--panel-2, rgba(127,127,127,.12))", fontVariantLigatures: "none" }}>{shown.password}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? t("pwCardCopied") : t("pwCardCopy")}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShown(null)}>
                <Icon name="eyeOff" size={13} /> {t("pwCardHide")}
              </button>
            </div>
          )}
          {status && <div className="small muted" role="status">{status}</div>}
        </div>
      )}

      <form onSubmit={save} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "1 1 220px", margin: 0 }}>
          <span>{t("pwCardSetLabel")}</span>
          <input dir="ltr" type="text" autoComplete="off" spellCheck={false} value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!next}>{t("pwCardSave")}</button>
      </form>
    </section>
  );
}
