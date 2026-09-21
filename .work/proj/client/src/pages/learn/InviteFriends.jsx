import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { GemIcon } from "../../components/StatIcons.jsx";

/* Invite Friends — double-sided referral dashboard + one-click social sharing
   with an Instagram-story card. Built to drive viral growth: personal code,
   pre-filled share text, emoji share buttons, milestone rewards, and a
   top-referrers leaderboard. All reward amounts are admin-controlled. */
export default function InviteFriends({ onProfile }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [social, setSocial] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/learn/referral").then(setD).catch(() => setD({ enabled: false }));
    api.get("/learn/social/config").then(setSocial).catch(() => {});
    api.get("/learn/referral/leaderboard").then((x) => setLeaders(x.leaders || [])).catch(() => {});
  }, [lang]);

  if (!d) return <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>;
  if (d.enabled === false) {
    return <div className="page"><div className="card empty-state"><div className="ico"><Icon name="users" size={40} /></div><h3>{fa ? "به‌زودی" : "Coming soon"}</h3></div></div>;
  }

  const site = social?.siteUrl || "medschool.ir";
  const link = `https://${site}/?ref=${d.code}`;
  const brand = social?.brandTag || "";
  const shareText = fa
    ? `من با MED School برای آزمون پزشکی آماده می‌شم و واقعاً عالیه! 🩺✨\nبا کد دعوت من رایگان ثبت‌نام کن و هدیه بگیر:\n${link}\n${brand}`
    : `I'm prepping for medical exams with MED School and it's great! 🩺✨\nSign up free with my invite and get a bonus:\n${link}\n${brand}`;

  const track = (channel) => { api.post("/learn/social/share", { kind: "invite", channel }).then((r) => { if (r?.rewardGems) { onProfile?.(); } }).catch(() => {}); };
  const copy = (text) => { try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ } };

  // channel share targets (open the app/site with pre-filled text)
  const enc = encodeURIComponent(shareText);
  const channels = [
    { id: "telegram", emoji: "✈️", label: "تلگرام", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${enc}` },
    { id: "whatsapp", emoji: "🟢", label: "واتساپ", url: `https://wa.me/?text=${enc}` },
    { id: "instagram", emoji: "📸", label: fa ? "اینستاگرام (کپی)" : "Instagram (copy)", copy: true },
    { id: "x", emoji: "𝕏", label: "X", url: `https://twitter.com/intent/tweet?text=${enc}` },
  ];
  const onChannel = (c) => {
    track(c.id);
    if (c.copy) { copy(shareText); return; }
    window.open(c.url, "_blank", "noopener");
  };

  return (
    <div className="page invite-page">
      <div className="section-title"><h2><Icon name="users" size={22} /> {t("inviteTitle")}</h2></div>

      {/* hero: double-sided reward pitch */}
      <div className="card invite-hero">
        <div className="invite-hero-emoji">🎁</div>
        <div className="invite-hero-text">
          <div className="invite-hero-head">{t("inviteHeadline")}</div>
          <div className="invite-hero-sub">
            {fa
              ? <>دوستت {d.rewards.referredGems} <GemIcon size={14} /> هدیه می‌گیرد و تو هم برای هر دوست {d.rewards.referrerGems} <GemIcon size={14} /> می‌گیری!</>
              : <>Your friend gets {d.rewards.referredGems} <GemIcon size={14} /> and you get {d.rewards.referrerGems} <GemIcon size={14} /> for each friend!</>}
          </div>
        </div>
      </div>

      {/* personal code + link */}
      <div className="card">
        <div className="small muted mb8">{t("inviteYourCode")}</div>
        <div className="invite-code-row">
          <div className="invite-code">{d.code}</div>
          <button className="btn btn-primary" onClick={() => copy(link)}>
            <Icon name={copied ? "check" : "download"} size={15} /> {copied ? t("copied") : t("inviteCopyLink")}
          </button>
        </div>
        <div className="invite-count small muted">{fa ? `تا حالا ${d.count} دوست دعوت کرده‌ای` : `You've invited ${d.count} friends so far`}</div>
      </div>

      {/* one-click social share (emoji buttons) */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>📣 {t("inviteShareVia")}</div>
        <div className="invite-share-grid">
          {channels.map((c) => (
            <button key={c.id} className="invite-share-btn" onClick={() => onChannel(c)}>
              <span className="ish-emoji">{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {social?.rewardGems > 0 && <div className="small muted mt8"><GemIcon size={14} /> {fa ? `برای اشتراک‌گذاری روزانه تا ${social.rewardGems} جم بگیر!` : `Earn up to ${social.rewardGems} gems for sharing daily!`}</div>}
      </div>

      {/* Instagram story card (download + copy caption) */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>📸 {t("inviteStoryCard")}</div>
        <div className="small muted mb8">{fa ? "این کارت را ذخیره کن و در استوری اینستاگرامت بگذار تا دوستانت با کد تو ثبت‌نام کنند." : "Save this card and post it to your Instagram story so friends sign up with your code."}</div>
        <StoryCard code={d.code} brand={brand} site={site} fa={fa} onShared={() => track("instagram")} />
      </div>

      {/* milestones */}
      {d.milestones?.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>🏆 {t("inviteMilestones")}</div>
          <div className="invite-milestones">
            {d.milestones.map((m) => (
              <div key={m.count} className={`invite-ms ${m.reached ? "reached" : ""}`}>
                <div className="ims-count">{fa ? `${m.label}` : m.label}</div>
                <div className="ims-reward">🎁 {m.gems} <GemIcon size={13} />{m.premium_days ? ` + ${m.premium_days}${fa ? " روز پریمیوم" : "d premium"}` : ""}</div>
                {m.reached && <div className="ims-check">✓</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* referrer leaderboard */}
      {leaders.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>👑 {t("inviteTopReferrers")}</div>
          {leaders.slice(0, 10).map((l) => (
            <div key={l.rank} className="invite-lb-row">
              <span className="ilb-rank">{l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : l.rank}</span>
              <span className="ilb-name">{l.name}{l.province ? ` · ${l.province}` : ""}</span>
              <span className="ilb-count">{l.count} 🎓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* An Instagram-story-sized card rendered as SVG so it can be downloaded as an
   image with no external assets. Self-contained (works offline / in sandbox). */
function StoryCard({ code, brand, site, fa, onShared }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2f7fd1"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>
  <rect width="360" height="640" fill="url(#g)"/>
  <text x="180" y="120" font-family="Tahoma,sans-serif" font-size="64" text-anchor="middle">🩺</text>
  <text x="180" y="180" font-family="Tahoma,sans-serif" font-size="30" font-weight="bold" fill="#fff" text-anchor="middle">MED School</text>
  <text x="180" y="230" font-family="Tahoma,sans-serif" font-size="17" fill="#dbe8fb" text-anchor="middle">${fa ? "آماده‌شدن برای آزمون پزشکی" : "Prep for medical exams"}</text>
  <text x="180" y="260" font-family="Tahoma,sans-serif" font-size="17" fill="#dbe8fb" text-anchor="middle">${fa ? "به‌سبک بازی و روزانه" : "the daily, game-like way"}</text>
  <rect x="50" y="320" width="260" height="120" rx="18" fill="#ffffff"/>
  <text x="180" y="360" font-family="Tahoma,sans-serif" font-size="14" fill="#68748a" text-anchor="middle">${fa ? "کد دعوت من" : "My invite code"}</text>
  <text x="180" y="405" font-family="monospace" font-size="40" font-weight="bold" fill="#2f7fd1" text-anchor="middle" letter-spacing="4">${code}</text>
  <text x="180" y="500" font-family="Tahoma,sans-serif" font-size="16" fill="#fff" text-anchor="middle">${fa ? "رایگان ثبت‌نام کن و هدیه بگیر 🎁" : "Sign up free & get a bonus 🎁"}</text>
  <text x="180" y="580" font-family="Tahoma,sans-serif" font-size="15" fill="#dbe8fb" text-anchor="middle">${site}</text>
  <text x="180" y="606" font-family="Tahoma,sans-serif" font-size="14" fill="#c7dbf7" text-anchor="middle">${brand}</text>
</svg>`;
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const download = () => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `medschool-invite-${code}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    onShared?.();
  };
  return (
    <div className="story-card-wrap">
      <img className="story-card-img" src={dataUrl} alt="story card" />
      <button className="btn btn-accent" onClick={download}><Icon name="download" size={15} /> {fa ? "ذخیرهٔ کارت استوری" : "Save story card"}</button>
    </div>
  );
}
