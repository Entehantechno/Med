import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Visual mnemonics (Sketchy-style): illustrated memory scenes with hooks that
   link each scene element to a fact. Authored by teachers/admins — no AI. */
export default function Mnemonics({ onBack }) {
  const { t, lang } = useApp();
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get(`/learn/mnemonics?lang=${lang}`).then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, [lang]);

  if (!items) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <div className="page">
      <div className="section-title"><h2>🧠 {t("mnemonics")}</h2></div>
      <div className="muted small mb16">{t("mnemonicsHint")}</div>

      {items.length === 0 ? (
        <div className="card empty-state"><div className="ico">🧠</div><h3>{t("mnemonicsEmpty")}</h3><div className="small muted">{t("mnemonicsEmptyHint")}</div></div>
      ) : (
        <div className="grid grid-2">
          {items.map((it) => (
            <div key={it.id} className="card mn-card">
              <div className="mn-title">{it.mnemonic.title || it.q}</div>
              {it.mnemonic.image
                ? <img className="mn-img" src={it.mnemonic.image} alt="" />
                : <div className="mn-img mn-placeholder">🎨</div>}
              {it.mnemonic.scene && <div className="mn-scene">{it.mnemonic.scene}</div>}
              {it.mnemonic.hooks?.length > 0 && (
                <ul className="mn-hooks">
                  {it.mnemonic.hooks.map((h, i) => <li key={i}><span className="mn-hook-dot">🔗</span> {h}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}
