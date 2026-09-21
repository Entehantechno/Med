import { useState, useEffect } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { TopBar, Spinner } from "../components/UI.jsx";
import { LineChart } from "../components/Charts.jsx";
import Icon from "../components/Icon.jsx";

export default function Profile({ home }) {
  const { t, user, lang, logoutAll } = useApp();
  const [cur, setCur] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user.role === "student") api.get("/reports/my").then(setStats).catch(() => setStats([]));
  }, []);

  const submit = async () => {
    setErr(""); setMsg(null);
    if (np !== np2) { setErr(t("passwordsNoMatch")); return; }
    try {
      await api.put("/auth/password", { currentPassword: cur, newPassword: np });
      setMsg(t("passwordChanged")); setCur(""); setNp(""); setNp2("");
    } catch { setErr(t("wrongCurrentPassword")); }
  };

  const avg = stats && stats.length ? Math.round(stats.reduce((a, b) => a + (b.score || 0), 0) / stats.length) : 0;
  const best = stats && stats.length ? Math.max(...stats.map((s) => s.score || 0)) : 0;

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2><Icon name="user" size={16} /> {t("profile")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <h4 className="mb16"><Icon name="idcard" size={16} /> {t("accountInfo")}</h4>
            <div className="info-row"><span>{t("name")}</span><span>{lang === "fa" ? user.name_fa : user.name_en}</span></div>
            <div className="info-row"><span>{user.role === "student" ? t("studentNo") : t("username")}</span><span>{user.username}</span></div>
            <div className="info-row"><span>{t("role")}</span><span>{t(user.role)}</span></div>
          </div>

          <div className="card">
            <h4 className="mb16"><Icon name="key" size={16} /> {t("changePassword")}</h4>
            {msg && <div className="feedback fb-ok mb16">{msg}</div>}
            {err && <div className="err-banner">{err}</div>}
            <div className="field"><label>{t("currentPassword")}</label>
              <input dir="ltr" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
            <div className="field"><label>{t("newPasswordField")}</label>
              <input dir="ltr" type="password" autoComplete="new-password" value={np} onChange={(e) => setNp(e.target.value)} /></div>
            <div className="field"><label>{t("confirmPassword")}</label>
              <input dir="ltr" type="password" autoComplete="new-password" value={np2} onChange={(e) => setNp2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
            <button className="btn btn-primary" onClick={submit}>{t("save")}</button>
          </div>
        </div>

        {user.role === "student" && (
          <div className="card mt16">
            <h4 className="mb16"><Icon name="chart" size={16} /> {t("myStats")}</h4>
            {!stats ? <Spinner /> : (<>
              <div className="grid grid-3">
                <div className="stat-card"><div className="num">{stats.length}</div><div className="lbl">{t("totalActivities")}</div></div>
                <div className="stat-card"><div className="num">{avg}</div><div className="lbl">{t("avgMyScore")}</div></div>
                <div className="stat-card"><div className="num">{best}</div><div className="lbl">{t("bestMyScore")}</div></div>
              </div>
              {stats.length >= 2 && (
                <div className="mt16">
                  <div className="small muted mb8"><Icon name="chart" size={16} /> {t("scoreTrend")}</div>
                  <LineChart values={[...stats].reverse().map((x) => x.score || 0)} color="var(--accent)" />
                </div>
              )}

              {/* Teacher's review & feedback on reviewed attempts */}
              {stats.some((s) => s.teacher_status) && (
                <div className="mt16">
                  <div className="small muted mb8"><Icon name="check" size={16} /> {lang === "fa" ? "بازخورد استاد" : "Teacher feedback"}</div>
                  {stats.filter((s) => s.teacher_status).map((s) => {
                    const st = s.teacher_status;
                    const label = st === "approved" ? (lang === "fa" ? "تأییدشده" : "Approved")
                      : st === "adjusted" ? (lang === "fa" ? "اصلاح‌شده" : "Adjusted")
                      : (lang === "fa" ? "ردشده" : "Rejected");
                    const col = st === "rejected" ? "var(--danger)" : st === "adjusted" ? "#c98a00" : "var(--ok)";
                    return (
                      <div className="card mb8" key={s.id} style={{ background: "var(--panel2)", borderInlineStart: `3px solid ${col}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <b>{lang === "fa" ? s.case_fa : s.case_en}</b>
                          <span className="tag" style={{ color: col, borderColor: col }}>{label} · {lang === "fa" ? "نمره" : "score"}: {s.final_score ?? s.score}</span>
                        </div>
                        {s.teacher_feedback && <div className="small" style={{ marginTop: 6, lineHeight: 1.9 }}>{s.teacher_feedback}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}
          </div>
        )}
      </div>
    </div>
  );
}
