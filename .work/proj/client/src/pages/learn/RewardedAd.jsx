import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* RewardedAd — Duolingo-Ads-2026 "rewarded video" format (simulated).
   The learner OPTS IN to watch a short (simulated) branded video; a countdown
   runs and, on completion, they receive gems. Premium learners see no ads.
   `format` = "rewarded" (default) or "prelesson" (pre-lesson sponsorship). */
export function RewardedAd({ format = "rewarded", nodeId = null, onClose, onReward }) {
  const { t, lang } = useApp();
  const [ad, setAd] = useState(undefined); // undefined=loading, null=none
  const [left, setLeft] = useState(0);
  const [phase, setPhase] = useState("offer"); // offer | playing | reward | capped
  const [reward, setReward] = useState(null);
  const [capInfo, setCapInfo] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let node = nodeId != null ? `&node=${nodeId}` : "";
    api.get(`/learn/ad?format=${format}${node}&lang=${lang}`)
      .then((d) => { setAd(d.ad || null); setCapInfo({ used: d.rewardedToday, cap: d.rewardCap }); })
      .catch(() => setAd(null));
    return () => clearInterval(timerRef.current);
  }, [format, nodeId, lang]);

  const play = () => {
    setPhase("playing");
    setLeft(ad.duration_s || 15);
    timerRef.current = setInterval(() => {
      setLeft((s) => { if (s <= 1) { clearInterval(timerRef.current); grant(); return 0; } return s - 1; });
    }, 1000);
  };

  const grant = async () => {
    try {
      const r = await api.post("/learn/ad/reward", { adId: ad.id, format });
      setReward(r.gems); setPhase("reward"); onReward?.(r.profile);
    } catch (e) {
      // 429 = daily cap reached
      setPhase("capped");
    }
  };

  if (ad === undefined) return null;
  if (ad === null) return null; // nothing to show (premium or unconfigured)

  return (
    <div className="rewarded-overlay" role="dialog" aria-modal="true">
      <div className="rewarded-modal" style={{ borderTop: `5px solid ${ad.bg}` }}>
        {phase === "offer" && (
          <>
            <div className="rw-tag">{t("rewardedTag")}</div>
            <div className="rw-video" style={{ background: `linear-gradient(135deg, ${ad.bg}, ${ad.bg}bb)` }}>
              <div className="rw-play">▶</div>
              {ad.sponsor && <div className="rw-sponsor">{ad.sponsor}</div>}
            </div>
            <h3>{ad.title}</h3>
            {ad.body && <p className="small muted">{ad.body}</p>}
            <div className="rw-reward-line">🎁 {t("rewardedEarn").replace("{n}", ad.reward_gems)}</div>
            <button className="btn btn-accent btn-block" onClick={play}><Icon name="play" size={16} /> {t("rewardedWatch")}</button>
            <button className="btn btn-ghost btn-block mt8" onClick={onClose}>{t("rewardedNoThanks")}</button>
            {capInfo && <div className="small muted center mt8">{t("rewardedCap").replace("{u}", capInfo.used).replace("{c}", capInfo.cap)}</div>}
          </>
        )}
        {phase === "playing" && (
          <>
            <div className="rw-video playing" style={{ background: `linear-gradient(135deg, ${ad.bg}, ${ad.bg}bb)` }}>
              <div className="rw-count">{left}</div>
              {ad.sponsor && <div className="rw-sponsor">{ad.sponsor}</div>}
              <div className="rw-title-ov">{ad.title}</div>
            </div>
            <div className="small muted center mt8">{t("rewardedPlaying")}</div>
          </>
        )}
        {phase === "reward" && (
          <div className="rw-done">
            <div className="rw-done-emoji">🎉</div>
            <h3>{t("rewardedGot").replace("{n}", reward)}</h3>
            <button className="btn btn-primary btn-block mt8" onClick={() => { onClose?.(); }}>{t("continueLearning")}</button>
          </div>
        )}
        {phase === "capped" && (
          <div className="rw-done">
            <div className="rw-done-emoji">✅</div>
            <h3>{t("rewardedCapReached")}</h3>
            <button className="btn btn-primary btn-block mt8" onClick={() => { onClose?.(); }}>{t("back")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
