import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { GemIcon, XpIcon, StreakIcon } from "../../components/StatIcons.jsx";
import { AdCard } from "./AdCard.jsx";
import { RewardedAd } from "./RewardedAd.jsx";
import { TierBadge } from "./TierBadge.jsx";
import OnboardingChecklist from "./OnboardingChecklist.jsx";
import WelcomeModal from "./WelcomeModal.jsx";
import MedGuide from "./MedGuide.jsx";
import { DailyReportCard } from "../../components/PeerBits.jsx";

export default function LearnHome({ go, goToTopic, openLesson, profile, onProfile, onHomeStats }) {
  const { t, lang, user, flag } = useApp();
  const [data, setData] = useState(null);
  const [streak, setStreak] = useState(null);   // Duolingo-style streak status
  const [showRewarded, setShowRewarded] = useState(false);
  const [placement, setPlacement] = useState(null);   // entry placement-test status
  const [recoHidden, setRecoHidden] = useState(false); // learner hid the "start here" tip
  const [showWelcome, setShowWelcome] = useState(false);

  const reload = () => {
    api.get(`/learn/home?lang=${lang}`).then((d) => { setData(d); onProfile?.(d.profile); onHomeStats?.(d); }).catch(() => setData({}));
    api.get(`/learn/streak?lang=${lang}`).then((d) => setStreak(d.status)).catch(() => {});
    api.get(`/learn/placement?lang=${lang}`).then(setPlacement).catch(() => setPlacement(null));
  };
  useEffect(() => { reload(); }, [lang]);

  const p = data?.profile || profile;
  // show the one-time welcome flow to brand-new learners
  useEffect(() => { if (p && !p.welcome_seen) setShowWelcome(true); }, [p?.welcome_seen]);
  if (!p) return <div className="card"><div className="skeleton" style={{ height: 120 }} /></div>;

  const goalPct = Math.min(100, Math.round(((data?.todayXp || 0) / (p.daily_goal || 30)) * 100));
  const uname = (lang === "fa" ? user.name_fa : user.name_en) || user.name_fa || "";

  return (
    <div className="page learn-home">
      {showWelcome && <WelcomeModal user={user} onDone={() => { setShowWelcome(false); reload(); }} />}

      {/* ---- Hero header: greeting + tier + quick stats, one clean strip ---- */}
      <div className="home-hero">
        <div className="home-hero-top">
          <div>
            <h2 className="home-greet">{t("welcome")}، {uname} 👋</h2>
            <TierBadge tier={p.tier} />
          </div>
          <div className="home-hero-stats">
            <span className="hh-stat" title={t("streak")}><StreakIcon size={17} /> <b>{p.streak}</b></span>
            <span className="hh-stat" title={t("gems")}><GemIcon size={17} /> <b>{p.gems}</b></span>
            <span className="hh-stat" title={t("xp")}><XpIcon size={17} /> <b>{p.xp}</b></span>
          </div>
        </div>
        {/* the ONE primary action + today's goal ring, front-and-center */}
        <div className="home-hero-main">
          <div className="goal-ring" style={{ "--pct": `${goalPct * 3.6}deg` }}>
            <div className="gv"><b>{data?.todayXp || 0}</b><div className="small muted">/ {p.daily_goal}</div></div>
          </div>
          <div className="home-hero-cta">
            <div className="hhc-title">{goalPct >= 100 ? `🎉 ${t("todayGoal")} ✓` : t("todayGoal")}</div>
            <div className="hhc-sub small">{streak?.atRisk ? `⚠️ ${t("streakAtRisk")}` : t("keepStreak")}</div>
            <button className="btn btn-accent btn-lg btn-block" onClick={() => {
              if (data?.resume?.nodeId && openLesson) openLesson(data.resume.nodeId);
              else go("path");
            }}>
              <Icon name="play" size={18} /> {t("continueLearning")}
            </button>
          </div>
        </div>
      </div>

      {/* Dr. Med — the medical guide/mascot: zone-aware adaptive encouragement
          driven by the automatic difficulty calibration (Challenge Point). */}
      <nav className="home-quick" aria-label={t("homeQuickTitle")}>
        <button type="button" onClick={() => go("path")}><span className="hq-ico"><Icon name="book" size={18} /></span>{t("navTabPath")}</button>
        {flag("srs_review") && <button type="button" onClick={() => go("review")}><span className="hq-ico"><Icon name="repeat" size={18} /></span>{t("navTabReview")}</button>}
        {flag("bank_browse") && <button type="button" onClick={() => go("browse")}><span className="hq-ico"><Icon name="search" size={18} /></span>{t("navTabBrowse")}</button>}
        {flag("quests") && <button type="button" onClick={() => go("quests")}><span className="hq-ico"><Icon name="target" size={18} /></span>{t("questsHub")}</button>}
      </nav>

      {flag("calibration") && <MedGuide />}

      {/* Round 9 — «گزارش روزانهٔ عملکرد» (مدوفست/UWorld-style daily report; premium) */}
      {flag("daily_report") && <DailyReportCard go={go} goToTopic={goToTopic} />}

      {/* Entry placement test — a FRIENDLY, low-stakes, DISMISSIBLE offer (never
          a forced exam). Only before it's taken and if not dismissed. */}
      {placement?.enabled && !placement?.done && !placement?.dismissed && (
        <div className="card mb16 placement-offer" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid var(--primary)" }}>
          <div className="mod-ico" style={{ background: "linear-gradient(135deg,#3b82f6,#6d28d9)", width: 48, height: 48, marginBottom: 0 }}>🧭</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{t("placementOfferTitle")}</div>
            <div className="small muted">{placement.offerText || t("placementOfferBody")}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => go("placement")}><Icon name="play" size={14} /> {t("placementStart")}</button>
            {placement.dismissible && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: ".78rem" }}
                onClick={async () => { await api.post("/learn/placement/dismiss", {}).catch(() => {}); setPlacement((p) => ({ ...p, dismissed: true })); }}>
                {t("placementNotNow")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Smart "start here" recommendation — shown AFTER the learner has taken the
          placement test. Plain-language, deterministic (server-computed), and
          dismissible so it never nags. Points to the weakest topic. */}
      {placement?.enabled && placement?.done && placement?.recommendation && !recoHidden && (
        <div className="card mb16 placement-reco" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid var(--green)" }}>
          <div className="mod-ico" style={{ background: "linear-gradient(135deg,#22a06b,#0f766e)", width: 48, height: 48, marginBottom: 0 }}>🎯</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{placement.recommendation.title}</div>
            <div className="small muted">{placement.recommendation.body}</div>
            {placement.recommendation.strongTopics?.length > 0 && (
              <div className="small mt4" style={{ color: "var(--green)" }}>
                💪 {t("placementYouAreStrong")}: {placement.recommendation.strongTopics.join("، ")}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn btn-primary btn-sm"
              onClick={() => (goToTopic ? goToTopic(placement.recommendation.startTopicSlug) : go("path"))}>
              <Icon name="play" size={14} /> {t("placementStartHere")}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: ".78rem" }} onClick={() => setRecoHidden(true)}>
              {t("dismiss") || t("placementNotNow")}
            </button>
          </div>
        </div>
      )}

      {/* Daily Diagnosis Challenge teaser — a quick daily habit hook */}
      {flag("dx_challenge") && (
        <div className="card mb16 dx-teaser" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid #e0533d" }}>
          <div className="mod-ico" style={{ background: "linear-gradient(135deg,#e0533d,#b5321e)", width: 48, height: 48, marginBottom: 0 }}>🩺</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{t("dxTitle")}</div>
            <div className="small muted">{t("dxTeaser")}</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => go("dxChallenge")}><Icon name="play" size={14} /> {t("dxPlay")}</button>
        </div>
      )}

      {/* getting-started onboarding checklist (new learners) */}
      <OnboardingChecklist go={go} onProfile={onProfile} />


      {/* streak milestone strip (freeze count + progress to next milestone) */}
      {streak?.nextMilestone && (
        <div className={`card mb16 streak-strip ${streak?.atRisk ? "at-risk" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="ss-flame"><StreakIcon size={30} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{p.streak} {t("dayStreak")}</div>
              <div className="ss-bar mt8"><span style={{ width: `${Math.min(100, Math.round((streak.streak / streak.nextMilestone) * 100))}%` }} /></div>
              <div className="small muted" style={{ marginTop: 4 }}>🎁 {streak.toNext} {t("daysToMilestone")}</div>
            </div>
            {streak?.freezes > 0 && <span className="ss-freezes"><Icon name="ampoule" size={14} /> {streak.freezes}</span>}
          </div>
        </div>
      )}

      {/* quests / chests teaser */}
      {flag("quests") && ((data?.questsClaimable > 0) || (data?.chestsReady > 0)) && (
        <div className="card mb16" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid var(--xp)" }}>
          <div className="mod-ico" style={{ background: "var(--grad-primary)", width: 48, height: 48, marginBottom: 0 }}><Icon name="target" size={24} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>
              {data.questsClaimable > 0 && `${data.questsClaimable} ${t("dailyQuests")} ✓`}
              {data.questsClaimable > 0 && data.chestsReady > 0 && " · "}
              {data.chestsReady > 0 && `${data.chestsReady} 🎁`}
            </div>
            <div className="small muted">{t("questsHub")}</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => go("quests")}><Icon name="target" size={14} /> {t("questsHub")}</button>
        </div>
      )}

      {/* spaced-repetition review reminder */}
      {flag("srs_review") && data?.dueReviews > 0 && (
        <div className="card mb16" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid var(--flame)" }}>
          <div className="mod-ico" style={{ background: "var(--grad-warm)", width: 48, height: 48, marginBottom: 0 }}><Icon name="repeat" size={24} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{data.dueReviews} {t("dueCount")}</div>
            <div className="small muted">{t("reviewDesc")}</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => go("review")}><Icon name="repeat" size={14} /> {t("review")}</button>
        </div>
      )}

      {/* Rewarded video — opt-in "watch to earn gems" (Duolingo Ads model).
          Hidden for premium AND when the premium/ads program is switched off. */}
      {!(p.premium_effective ?? p.premium) && (
        <div className="card mb16 rewarded-cta" style={{ display: "flex", alignItems: "center", gap: 14, borderInlineStart: "4px solid var(--gem, #8b5cf6)" }}>
          <div className="mod-ico" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", width: 48, height: 48, marginBottom: 0 }}>🎁</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{t("rewardedCtaTitle")}</div>
            <div className="small muted">{t("rewardedCtaBody")}</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => setShowRewarded(true)}><Icon name="play" size={14} /> {t("rewardedWatch")}</button>
        </div>
      )}
      {showRewarded && (
        <RewardedAd format="rewarded" onClose={() => setShowRewarded(false)}
          onReward={(prof) => { if (prof) { onProfile?.(prof); setData((d) => d ? { ...d, profile: prof } : d); } }} />
      )}

      {/* ad slot (hidden for premium) */}
      {data?.ads?.length > 0 && <div className="mb16"><AdCard ad={data.ads[0]} /></div>}

      {/* national ranking preview */}
      {flag("ranking") && <div className="card">
        <div className="section-title"><h4><Icon name="chart" size={18} /> {t("topLearners")}</h4>
          <button className="btn btn-ghost btn-sm" onClick={() => go("ranking")}>{t("ranking")}</button></div>
        {(data?.topCountry || []).map((r) => (
          <div key={r.user_id} className="case-item" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="rank-num" style={{ fontWeight: 900, width: 26 }}>#{r.rank}</span>
              <div><div style={{ fontWeight: 700 }}>{r.name}</div>
                <div className="small muted">{r.province}</div></div>
            </div>
            <span className="tag"><Icon name="medal" size={14} /> {r.xp} {t("xp")}</span>
          </div>
        ))}
        {data?.myRank && <div className="small muted mt8" style={{ textAlign: "center" }}>
          {t("yourRank")}: <b style={{ color: "var(--primary)" }}>#{data.myRank}</b></div>}
      </div>}
    </div>
  );
}
