import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Personal-info card (self-service).
   Lets any signed-in user edit optional fields (phone, email display, short bio)
   and — importantly — set a NICKNAME and toggle "anonymous" identity:
     • anon OFF (default) → real name is shown in rankings/competition
     • anon ON            → the nickname is shown instead (privacy in competition)
   AI-free & deterministic. Writes to PUT /auth/me. */
export default function ProfileCard() {
  const { t, lang, user, setUser } = useApp();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/auth/me").then((d) => {
      const u = d.user || {};
      setF({ phone: u.phone || "", bio: u.bio || "", nickname: u.nickname || "", anon_mode: !!u.anon_mode });
    }).catch(() => setF({ phone: "", bio: "", nickname: "", anon_mode: false }));
  }, []);

  if (!f) return null;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.put("/auth/me", f);
      const u = r.user || {};
      setF({ phone: u.phone || "", bio: u.bio || "", nickname: u.nickname || "", anon_mode: !!u.anon_mode });
      if (setUser && u.id) setUser((prev) => ({ ...prev, ...u }));
      setMsg(t("saved"));
    } catch (e) { setMsg(e.message || "error"); }
    finally { setBusy(false); }
  };

  const realName = lang === "fa" ? (user?.name_fa || user?.name_en) : (user?.name_en || user?.name_fa);
  // if anon is on but no nickname, the toggle can't take effect
  const anonBlocked = f.anon_mode && !f.nickname.trim();

  return (
    <div className="card set-card profile-card">
      <div className="set-head"><Icon name="users" size={16} /> {t("personalInfo")}</div>
      <p className="small muted" style={{ marginTop: -2 }}>{t("personalInfoHint")}</p>

      <div className="calm-field">
        <label>{t("nickname")}</label>
        <input type="text" value={f.nickname} maxLength={32} disabled={busy}
          placeholder={t("nicknamePh")} onChange={(e) => set("nickname", e.target.value)} />
        <div className="small muted">{t("nicknameHint")}</div>
      </div>

      {/* identity display: real name vs nickname (anonymous) */}
      <div className="set-row" style={{ marginTop: 6 }}>
        <div>
          <div className="set-label">{t("anonEnable")}</div>
          <div className="small muted">
            {f.anon_mode
              ? t("showAsNickname").replace("{n}", f.nickname.trim() || realName || "—")
              : t("showAsRealName").replace("{n}", realName || "—")}
          </div>
        </div>
        <div className={`switch ${f.anon_mode ? "on" : ""}`} role="switch" aria-checked={f.anon_mode}
          aria-label={t("anonEnable")} onClick={() => !busy && set("anon_mode", !f.anon_mode)}><span className="slider" /></div>
      </div>
      {anonBlocked && <div className="small" style={{ color: "var(--warn, #c98a00)" }}>⚠️ {t("nicknameRequiredForAnon")}</div>}

      <div className="calm-field" style={{ marginTop: 10 }}>
        <label>{t("phone")} ({t("optional")})</label>
        <input type="tel" dir="ltr" value={f.phone} maxLength={32} disabled={busy}
          placeholder="09xxxxxxxxx" onChange={(e) => set("phone", e.target.value)} />
      </div>

      <div className="calm-field">
        <label>{t("bio")} ({t("optional")})</label>
        <textarea value={f.bio} maxLength={280} disabled={busy} rows={2}
          placeholder={t("bioPh")} onChange={(e) => set("bio", e.target.value)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{t("save")}</button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </div>
  );
}
