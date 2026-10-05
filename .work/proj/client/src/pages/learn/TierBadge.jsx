import { useApp } from "../../context.jsx";
import Icon from "../../components/Icon.jsx";

const LABELS = {
  bronze: { fa: "برنز", en: "Bronze" }, silver: { fa: "نقره", en: "Silver" },
  gold: { fa: "طلا", en: "Gold" }, sapphire: { fa: "یاقوت کبود", en: "Sapphire" },
  ruby: { fa: "یاقوت سرخ", en: "Ruby" }, diamond: { fa: "الماس", en: "Diamond" },
};

export function TierBadge({ tier = "bronze", size = 16 }) {
  const { lang } = useApp();
  const l = LABELS[tier] || LABELS.bronze;
  return (
    <span className={`tier-badge tb-${tier}`}>
      <Icon name="trophy" size={size} /> {lang === "fa" ? l.fa : l.en}
    </span>
  );
}
