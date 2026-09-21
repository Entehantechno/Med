import { useApp } from "../context.jsx";
import Icon from "../components/Icon.jsx";

/* Full-screen "we're doing maintenance" page shown to non-admin visitors when
   an admin turns on maintenance mode. Admins never see this (they keep access
   so they can turn it back off). Texts come from the admin-set maintenance
   config, falling back to friendly defaults. */
export default function Maintenance({ info, onAdminLogin }) {
  const { lang, toggleLang, theme, toggleTheme } = useApp();
  const fa = lang === "fa";
  const title = (fa ? info?.title_fa : info?.title_en) || (fa ? "سایت در حال تعمیر است" : "We're under maintenance");
  const body = (fa ? info?.body_fa : info?.body_en) || (fa ? "به‌زودی با نسخهٔ بهتری برمی‌گردیم. لطفاً کمی بعد دوباره سر بزنید." : "We'll be back shortly with an improved experience. Please check back soon.");
  return (
    <div className="maintenance-screen">
      <div className="maintenance-topbar">
        <button className="btn btn-ghost btn-sm" onClick={toggleLang}><Icon name="globe" size={16} /> {fa ? "English" : "فارسی"}</button>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme}><Icon name={theme === "dark" ? "sun" : "moon"} size={16} /></button>
      </div>
      <div className="maintenance-card">
        <div className="maintenance-emoji">🛠️</div>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="maintenance-brand"><Icon name="cap" size={20} /> MED School</div>
        {onAdminLogin && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={onAdminLogin}>
            <Icon name="user" size={14} /> {fa ? "ورود مدیران" : "Admin login"}
          </button>
        )}
      </div>
    </div>
  );
}
