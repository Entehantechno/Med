import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Avatar from "../../components/Avatar.jsx";
import Podium from "./Podium.jsx";

export default function RankingView() {
  const { t, lang } = useApp();
  const [scope, setScope] = useState("country");   // country | province
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const url = scope === "province" ? "/learn/ranking/province" : "/learn/ranking";
    api.get(`${url}?lang=${lang}`).then(setData).catch(() => setData({ list: [] }));
  }, [lang, scope]);

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="chart" size={22} /> {t("ranking")}</h2></div>

      {/* country / province toggle — fuels regional competition */}
      <div className="tabs mb16">
        <button className={`tab ${scope === "country" ? "active" : ""}`} onClick={() => setScope("country")}>
          <Icon name="globe" size={15} /> {t("countryRank")}
        </button>
        <button className={`tab ${scope === "province" ? "active" : ""}`} onClick={() => setScope("province")}>
          <Icon name="medal" size={15} /> {t("provinceRank")}
        </button>
      </div>

      {!data ? <div className="card"><div className="skeleton" style={{ height: 200 }} /></div> : (<>
        {scope === "province" && data.province && (
          <div className="muted small mb8">{t("provinceRankOf")}: <b>{data.province}</b></div>
        )}
        {scope === "province" && !data.province && (
          <div className="card empty-state"><div className="ico"><Icon name="medal" size={36} /></div>
            <h3>{t("noProvince")}</h3><div className="small muted">{t("noProvinceHint")}</div></div>
        )}

        {data.myRank && (() => {
          const total = data.total || data.list?.length || data.myRank;
          const pct = total > 0 ? Math.max(1, Math.round((data.myRank / total) * 100)) : null;
          return (
            <div className="card rank-hero mb16">
              <div className="rank-hero-badge">#{data.myRank}</div>
              <div className="rank-hero-info">
                <div className="rank-hero-label">{t("yourRank")}{scope === "province" ? ` (${data.province})` : ""}</div>
                <div className="rank-hero-sub">{t("rankOfTotal").replace("{n}", total)}</div>
                {pct != null && <span className="rank-hero-pct">{t("topPercent").replace("{p}", pct)}</span>}
              </div>
            </div>
          );
        })()}

        {data.list?.length >= 3 && <Podium top={data.list} meId={data.me} />}

        {data.list?.length > 0 && (() => {
          const topXp = Math.max(1, ...data.list.map((r) => r.xp || 0));
          return (
            <div className="card rank-list" style={{ padding: 0, overflow: "hidden" }}>
              {data.list.map((r) => {
                const isMe = r.user_id === data.me;
                return (
                  <div key={r.user_id} className={`rank-row ${isMe ? "is-me" : ""} ${r.rank <= 3 ? "is-top" : ""}`}>
                    <span className="rank-num">
                      {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                    </span>
                    <Avatar name={r.name} size={34} tier={r.tier} />
                    <div className="rank-main">
                      <div className="rank-name">{r.name}{r.anon ? " 🕶️" : ""}{isMe ? ` · ${t("rankYou")}` : ""}</div>
                      <div className="rank-bar"><span style={{ width: `${Math.round(((r.xp || 0) / topXp) * 100)}%` }} /></div>
                      <div className="small muted rank-prov">{r.province}</div>
                    </div>
                    <span className={`tier-badge tb-${r.tier} rank-tier`} title={r.tier}>
                      <Icon name="trophy" size={12} />
                    </span>
                    <span className="rank-xp"><Icon name="medal" size={13} /> {r.xp}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </>)}
    </div>
  );
}
