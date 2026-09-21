import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, useToast } from "../../components/UI.jsx";

const ROLE_LABEL = {
  content_manager: { fa: "مدیر محتوا", en: "Content manager" },
  support: { fa: "پشتیبانی", en: "Support" },
  teacher: { fa: "استاد", en: "Teacher" },
  learner: { fa: "کاربر رقابتی", en: "Learner" },
  student: { fa: "دانشجو", en: "Student" },
};

/* Admin edits which permissions each role has — no code required.
   The admin role itself is always all-powerful and not editable. */
export default function RoleEditor() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get("/admin/roles").then((d) => { setData(d); setDraft(JSON.parse(JSON.stringify(d.rolePerms))); }).catch(() => setData({ permissions: {}, editableRoles: [], rolePerms: {} }));
  }, []);
  if (!data) return <Spinner />;

  const toggle = (role, perm) => setDraft((s) => {
    const has = s[role].includes(perm);
    return { ...s, [role]: has ? s[role].filter((p) => p !== perm) : [...s[role], perm] };
  });
  const save = async (role) => {
    setBusy(role);
    try { const r = await api.put(`/admin/roles/${role}`, { perms: draft[role] }); setDraft(JSON.parse(JSON.stringify(r.rolePerms))); toast(t("saved")); }
    finally { setBusy(""); }
  };

  const permList = Object.entries(data.permissions);
  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="shield" size={22} /> {t("roleEditor")}</h2></div>
      <div className="muted small mb16">{t("roleEditorHint")}</div>

      <div className="rbac-role" style={{ borderColor: "var(--accent)", background: "var(--accentGlow)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
          <Icon name="crown" size={16} /> {t("admin")} — {t("allAccess")}
        </div>
        <div className="small muted mt8">{t("adminAlwaysAll")}</div>
      </div>

      {data.editableRoles.map((role) => (
        <div className="rbac-role" key={role}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>{lang === "fa" ? ROLE_LABEL[role]?.fa : ROLE_LABEL[role]?.en} <span className="small muted">({draft[role]?.length || 0})</span></div>
            <button className="btn btn-primary btn-sm" disabled={busy === role} onClick={() => save(role)}><Icon name="check" size={13} /> {t("save")}</button>
          </div>
          <div className="rbac-perms">
            {permList.map(([key, desc]) => (
              <label className="rbac-perm" key={key}>
                <input type="checkbox" checked={draft[role]?.includes(key) || false} onChange={() => toggle(role, key)} />
                <span><b style={{ direction: "ltr", display: "inline-block" }}>{key}</b><div className="small muted">{desc}</div></span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
