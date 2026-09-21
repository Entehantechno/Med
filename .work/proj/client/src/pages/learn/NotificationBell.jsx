import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { subscribePush } from "./push.js";

export function NotificationBell({ onNavigate }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unseen: 0, items: [] });
  const ref = useRef(null);

  const load = () => api.get(`/learn/notifications?lang=${lang}`).then(setData).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [lang]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && data.unseen > 0) {
      await api.post("/learn/notifications/seen").catch(() => {});
      setData((d) => ({ ...d, unseen: 0 }));
    }
  };

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="btn btn-sm btn-ghost icon-btn bell-btn" onClick={toggle} title={t("notifications")}>
        <Icon name="clock" size={16} />
        {data.unseen > 0 && <span className="bell-badge">{data.unseen}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <b>{t("notifications")}</b>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: ".72rem" }} onClick={() => subscribePush(t)}>
              <Icon name="clock" size={12} /> {t("enableNotif")}
            </button>
          </div>
          {data.items.length === 0 && <div className="muted small" style={{ padding: 20, textAlign: "center" }}>{t("noNotif")}</div>}
          {data.items.map((n) => (
            <div key={n.id} className={`notif-item ${n.seen ? "" : "unseen"}`}
              onClick={() => { setOpen(false); if (n.link) onNavigate?.(n.link); }}>
              <div className="notif-ico"><Icon name={n.icon || "clock"} size={18} /></div>
              <div style={{ minWidth: 0 }}>
                <h5>{n.title}</h5>
                <p>{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
