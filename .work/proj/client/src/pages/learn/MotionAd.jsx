import { useApp } from "../../context.jsx";
import { api } from "../../api.js";

/* ──────────────────────────────────────────────────────────
   MOTION AD — bilingual high-end motion-graphic ad card
   Used in learning-path slots: path, lesson-intro, between-lessons
   Variants: path (inline) · intro (hero) · between (celebrate)
   Each variant has its own palette, typography and micro-motion.
   Click records via /learn/ads/:id/click but visuals are always
   premium — even for the built-in curated promos (no admin ad).
   ────────────────────────────────────────────────────────── */

function useLang() {
  const { lang } = useApp();
  return lang === "fa" ? "fa" : "en";
}

const CURATED = {
  fa: {
    path: {
      kicker: "پیشنهاد مسیر",
      title: "حافظه‌ات را جاودانه کن — مرور هوشمند",
      body: "الگوریتم FSRS هر کارت را دقیقاً پیش از فراموشی برمی‌گرداند. ۱۱٬۶۰۰ سؤال رسمی، دسته‌بندی ملی/قطبی، و درسنامهٔ مبتنی بر هاریسون.",
      pills: ["⏱ مرور ۵ دقیقه‌ای", "🧠 ماندگاری ۹۰٪", "📚  هاریسون"],
      cta: "مرور را شروع کن",
      media: "🧠",
    },
    intro: {
      kicker: "آماده‌ای؟  نفس عمیق  —  ذهن روشن",
      title: "این درس، یک قدم به تسلط نزدیک‌تر",
      body: "هر سؤال، یک کیس واقعی با نکتهٔ طلایی و بررسی تک‌تک گزینه‌ها. با تمرکز کامل شروع کن — قلب‌ها منتظر خطای تو نیستند.",
      pills: ["🎯 کیس‌محور", "✨ نکتهٔ طلایی", "📖 رفرنس هر سؤال fa+en"],
      cta: "شروعِ درس  →",
      media: "⚡",
    },
    between: {
      kicker: "شاهکار کردی!",
      title: "یک قدم تا استادی — ادامه می‌دهی؟",
      body: "پیشرفت امروز عالی‌ست. یک درس دیگر و استریک‌ات را بسوزان؛ لیگ هفتگی منتظر صعود توست.",
      pills: ["🔥 استریک زنده", "🏆 لیگ فعال", "💎 XP دوبرابر"],
      cta: "درسِ بعدی",
      media: "🚀",
    },
  },
  en: {
    path: {
      kicker: "Path pick",
      title: "Make memory stick — Smart Review",
      body: "FSRS brings each card back just before you’d forget. 11.6k official questions, national/pole filters, and Harrison-based micro-lessons.",
      pills: ["⏱ 5-min review", "🧠 90% retention", "📚 Harrison"],
      cta: "Start review",
      media: "🧠",
    },
    intro: {
      kicker: "Ready?  Deep breath  —  sharp mind",
      title: "One lesson closer to mastery",
      body: "Every question is a real case with a golden note and per-option rationale. Start focused — hearts don’t wait for slips.",
      pills: ["🎯 Case-based", "✨ Golden note", "📖 fa+en refs"],
      cta: "Start lesson →",
      media: "⚡",
    },
    between: {
      kicker: "You crushed it!",
      title: "One step to mastery — keep going?",
      body: "Today’s progress is superb. One more lesson keeps your streak alive; the weekly league is ready for your climb.",
      pills: ["🔥 Streak live", "🏆 League on", "💎 Double XP"],
      cta: "Next lesson",
      media: "🚀",
    },
  },
};

// curated variant palette mapping
const VARIANT_CFG = {
  path:    { theme: "",      size: "compact" }, // compact inline
  intro:   { theme: "teal",  size: "intro" },   // immersive hero intro
  between: { theme: "gold",  size: "" },        // warm celebrate
};

export function MotionAd({ ad, variant = "path", onCta }) {
  const lang = useLang();
  const fa = lang === "fa";
  const cfg = VARIANT_CFG[variant] || VARIANT_CFG.path;
  const curated = CURATED[lang][variant] || CURATED[lang].path;

  // if an admin ad exists, use its copy inside the motion shell;
  // otherwise fall back to the curated copy — always beautiful.
  const title = ad?.title || curated.title;
  const body = ad?.body || curated.body;
  const ctaLabel = ad?.cta || curated.cta;
  const kicker = ad?.sponsor ? `${fa ? "حمایت‌شده" : "Sponsored"} · ${ad.sponsor}` : curated.kicker;
  const pills = ad?.pills || curated.pills;
  const mediaIcon = ad?.image ? null : curated.media; // image overrides icon
  const href = ad?.url || null;

  const onClick = () => {
    if (ad?.id) api.post(`/learn/ads/${ad.id}/click`).catch(() => {});
    if (onCta) onCta();
  };

  const themeCls = cfg.theme ? ` motion-ad--${cfg.theme}` : "";
  const sizeCls = cfg.size ? ` motion-ad--${cfg.size}` : "";

  return (
    <div className={`motion-ad${themeCls}${sizeCls}`} role="group" aria-label={title} dir={fa ? "rtl" : "ltr"}>
      <span className="motion-ad__tag">{fa ? "تبلیغ" : "Ad"}</span>
      <div className="motion-ad__bg" aria-hidden="true" />
      <div className="motion-ad__grid" aria-hidden="true" />
      <div className="motion-ad__grain" aria-hidden="true" />
      <div className="motion-ad__orb motion-ad__orb--1" aria-hidden="true" />
      <div className="motion-ad__orb motion-ad__orb--2" aria-hidden="true" />
      <div className="motion-ad__orb motion-ad__orb--3" aria-hidden="true" />
      <div className="motion-ad__shine" aria-hidden="true" />

      {/* subtle floating contextual badges for premium feel */}
      {variant === "path" && (
        <div className="motion-ad__float-badges" aria-hidden="true">
          <span className="motion-ad__float-badge motion-ad__float-badge--a">✦ FSRS</span>
        </div>
      )}

      <div className="motion-ad__inner">
        {/* media */}
        <div className="motion-ad__media" aria-hidden="true">
          {ad?.image ? (
            <img src={ad.image} alt="" loading="lazy" />
          ) : (
            <span>{mediaIcon}</span>
          )}
        </div>

        {/* copy */}
        <div className="motion-ad__text">
          <span className="motion-ad__kicker">{kicker}</span>
          <h4 className="motion-ad__title motion-ad__title--grad">{title}</h4>
          <p className="motion-ad__body">{body}</p>

          {/* ECG line for intro variant */}
          {variant === "intro" && (
            <svg className="motion-ad__ecg" viewBox="0 0 340 34" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 18 H42 L56 18 L64 6 L74 28 L84 12 L92 18 H128 L138 18 L146 4 L158 30 L168 18 H203 L212 18 L221 8 L231 26 L241 18 H340" />
            </svg>
          )}

          {/* progress hint for between variant */}
          {variant === "between" && (
            <div className="motion-ad__progress" style={{ "--w": "74%" }} aria-hidden="true"><span /></div>
          )}

          <div className="motion-ad__bullets">
            {pills.map((p, i) => (
              <span key={i} className="motion-ad__pill">{p}</span>
            ))}
          </div>

          {href ? (
            <a className={`motion-ad__cta${cfg.theme === "gold" ? " motion-ad__cta--gold" : ""}`} href={href} target="_blank" rel="noreferrer" onClick={onClick}>
              {ctaLabel} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <button type="button" className={`motion-ad__cta${cfg.theme === "gold" ? " motion-ad__cta--gold" : ""}`} onClick={onClick}>
              {ctaLabel} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Curated path ad — always available even without admin ads */
export function CuratedPathAd({ onCta }) {
  return <MotionAd variant="path" onCta={onCta} />;
}
export function CuratedIntroAd({ onCta }) {
  return <MotionAd variant="intro" onCta={onCta} />;
}
export function CuratedBetweenAd({ onCta }) {
  return <MotionAd variant="between" onCta={onCta} />;
}
