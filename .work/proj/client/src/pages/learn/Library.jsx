import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";

/* Premium card library: licensed cards grouped by category, for premium users,
   independent of the learning path. A promised premium benefit. */
export default function Library() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [premium, setPremium] = useState(true);
  const [openCat, setOpenCat] = useState(null);

  useEffect(() => {
    api.get(`/learn/library?lang=${lang}`)
      .then((d) => { setData(d); setOpenCat(d.categories?.[0]?.name || null); })
      .catch((e) => { if (String(e.message).includes("402") || String(e.message).includes("premium")) setPremium(false); setData({ categories: [] }); });
  }, [lang]);

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;

  if (!premium)
    return (
      <div className="card empty-state">
        <div className="ico"><Icon name="crown" size={40} /></div>
        <h3>{t("premiumOnly")}</h3>
        <div className="small muted">{t("premiumLibraryHint")}</div>
        <button className="btn btn-accent mt16" type="button" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))}>
          <Icon name="crown" size={15} /> {t("browseGoPremium")}
        </button>
      </div>
    );

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="crown" size={22} /> {t("premiumLibrary")}</h2></div>
      <div className="muted small mb16">{t("premiumLibraryHint")}</div>
      {data.categories.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="book" size={40} /></div><h3>{t("noData")}</h3></div>}
      {data.categories.map((cat) => (
        <div className="card mb8" key={cat.name}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setOpenCat(openCat === cat.name ? null : cat.name)}>
            <strong>{cat.name} <span className="small muted">({cat.count})</span></strong>
            <Icon name={openCat === cat.name ? "chevronUp" : "chevronDown"} size={16} />
          </div>
          {openCat === cat.name && <div className="mt8">{cat.cards.map((c) => <LibCard key={c.id} card={c} />)}</div>}
        </div>
      ))}
    </div>
  );
}

/* A self-study card: reveal answer + micro lesson, and save for later. */
function LibCard({ card }) {
  const { t } = useApp();
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(null);
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;

  useEffect(() => { api.get(`/learn/library/save/${card.id}`).then((d) => setSaved(d.saved)).catch(() => setSaved(false)); }, [card.id]);
  const toggleSave = async () => { const r = await api.post(`/learn/library/save/${card.id}`, {}); setSaved(r.saved); };

  return (
    <div className="lib-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{card.q}</div>
        <button className={`btn btn-sm ${saved ? "btn-accent" : "btn-ghost"}`} onClick={toggleSave} title={t("saveForLater")}>
          <Icon name="star" size={13} /> {saved ? t("savedCard") : t("saveCard")}
        </button>
      </div>
      {!revealed
        ? <button className="btn btn-ghost btn-sm mt8" onClick={() => setRevealed(true)}><Icon name="check" size={13} /> {t("showAnswer")}</button>
        : (<div className="mt8">
            <Type card={card} checked sel={correctSel(card)} setSel={() => {}} isCorrect />
            {card.micro && <MicroLesson micro={card.micro} defaultOpen />}
          </div>)}
    </div>
  );
}
// pre-select the correct option so revealed cards show the answer highlighted
function correctSel(card) {
  if (card.type === "mcq") { const i = (card.options || []).findIndex((o) => o.correct); return i >= 0 ? i : null; }
  if (card.type === "truefalse") return card.answer;
  return null;
}
