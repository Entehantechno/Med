import { useApp } from "../../context.jsx";
import { api } from "../../api.js";

/* Simulated ad slot. Clicking records a click (no real navigation for demo). */
export function AdCard({ ad }) {
  const { t } = useApp();
  if (!ad) return null;
  const click = () => { api.post(`/learn/ads/${ad.id}/click`).catch(() => {}); };
  return (
    <div className="ad-card" style={{ background: `linear-gradient(135deg, ${ad.bg}, ${ad.bg}cc)` }}>
      <span className="ad-tag">{t("sponsored")}{ad.sponsor ? ` · ${ad.sponsor}` : ""}</span>
      {ad.image && <img className="ad-image" src={ad.image} alt="" />}
      {ad.title && <h4>{ad.title}</h4>}
      {ad.body && <p>{ad.body}</p>}
      {(ad.cta || ad.url) && <a className="ad-cta" href={ad.url || undefined} target={ad.url ? "_blank" : undefined} rel="noreferrer" onClick={click}>{ad.cta || t("startNow")}</a>}
    </div>
  );
}
