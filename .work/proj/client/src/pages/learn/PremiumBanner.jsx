import { useApp } from "../../context.jsx";
import { useEffect, useState } from "react";
import { api } from "../../api.js";

/* ──────────────────────────────────────────────────────────────
   PREMIUM BANNERS — bilingual high-end motion upsell
   Variants:
     hero    — large home / path header upsell
     inline  — compact review/browse/leaderboard inline
     card    — grid card for between-lessons celebrate area
     mini    — slim leaderboard/home strip
   Palette: warm gold/amber, crown, glass, shine sweep, orbs.
   Fonts: Estedad 900 for title · Vazirmatn for body.
   Pricing: live from getPlans() (/pay/plans or admin pricing) — so the
   banner never drifts from checkout. Falls back to defaults.
   ────────────────────────────────────────────────────────────── */

function useLang() {
  const { lang } = useApp();
  return lang === "fa" ? "fa" : "en";
}

function usePlansToman() {
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    let alive = true;
    // learner-visible pricing source: /api/pay/plans (authed) with fallback to /api/admin/pricing attempt
    api.get("/pay/plans").then((d) => {
      if (!alive) return;
      if (d?.monthly || d?.plans?.monthly) setPlans(d.plans || d);
    }).catch(() => {
      api.get("/admin/pricing").then((d) => { if (alive && (d.monthly || d.yearly)) setPlans(d); }).catch(() => {});
    });
    return () => { alive = false; };
  }, []);
  return plans;
}
function fmtToman(rial) {
  try { return Math.round(Number(rial) / 10).toLocaleString("fa-IR"); }
  catch { return String(Math.round(Number(rial) / 10)); }
}
function fmtUSD(rial) {
  // rough display helper for en: show as $ when rial is tiny is not meaningful;
  // we show monthly $ equiv = rial / 10 / 420000 (~USD via free rate) capped.
  // Simpler: show toman even in en with $ prefix if needed? We show toman.
  return Math.round(Number(rial) / 10).toLocaleString("en-US");
}

const FALLBACK_MONTHLY_RIAL = 990000; // 99k toman
const FALLBACK_YEARLY_RIAL  = 7900000; // 790k toman

const COPY = {
  fa: {
    hero: {
      kicker: "👑 پیشنهاد ویژه · محدود",
      title: "پرمیوم پلاس — <em>بی‌مرز بخوان</em>",
      body: "۱۱٬۶۰۰ سؤال رسمی با فیلتر سال و مبحث، قلب نامحدود، بدون تبلیغ، مرور هوشمند و خلاصهٔ هر فصل.",
      pills: ["♾️ قلب نامحدود", "🚫 بدون تبلیغ", "📚 ۱۱٬۶۰۰ سؤال", "🧠 FSRS"],
      cta: "فعال‌سازی پلاس",
      ghost: "مشاهدهٔ پلن‌ها",
    },
    inline: {
      kicker: "👑 پلاس",
      title: "بانک کامل سؤالات + <em>بدون تبلیغ</em>",
      body: "جست‌وجوی هوشمند، فیلتر سال/مبحث و خلاصهٔ هر فصل فقط با پلاس.",
      pills: ["🔍 جست‌وجوی هوشمند", "🚫 بدون تبلیغ", "♾️ قلب نامحدود"],
      cta: "ارتقا به پلاس",
      ghost: "بعداً",
    },
    card: {
      kicker: "👑 پلاس — مسیر بدون توقف",
      title: "درسِ بعدی را <em>بی‌وقفه</em> ادامه بده",
      body: "با پلاس، استریک و قلب‌ات هرگز نمی‌سوزد و هر سؤال، درسنامهٔ هاریسونیِ خودش را دارد.",
      pills: ["🔥 محافظ استریک", "♾️ قلب نامحدود", "📖 هاریسون"],
      cta: "شروع پلاس",
      ghost: "بعداً",
    },
    mini: {
      kicker: "پلاس",
      title: "پلاس — مطالعهٔ <em>بی‌وقفه</em>",
      body: "قلب نامحدود · بدون تبلیغ · ۱۱٬۶۰۰ سؤال",
      pills: [],
      cta: "ارتقا",
      ghost: null,
    },
  },
  en: {
    hero: {
      kicker: "👑 Limited offer",
      title: "Premium Plus — <em>study without limits</em>",
      body: "11.6k official questions with year/chapter filters, unlimited hearts, no ads, Smart Review and per-chapter summaries.",
      pills: ["♾️ Unlimited hearts", "🚫 No ads", "📚 11.6k Qs", "🧠 FSRS"],
      cta: "Unlock Plus",
      ghost: "View plans",
    },
    inline: {
      kicker: "👑 Plus",
      title: "Full question bank + <em>no ads</em>",
      body: "Smart search, year/chapter filters and summaries unlock on Plus.",
      pills: ["🔍 Smart search", "🚫 No ads", "♾️ Unlimited hearts"],
      cta: "Upgrade to Plus",
      ghost: "Later",
    },
    card: {
      kicker: "👑 Plus — unstoppable path",
      title: "Keep going <em>without pause</em>",
      body: "On Plus your streak and hearts never burn, and every question has its own Harrison micro-lesson.",
      pills: ["🔥 Streak freeze", "♾️ Unlimited hearts", "📖 Harrison"],
      cta: "Get Plus",
      ghost: "Later",
    },
    mini: {
      kicker: "Plus",
      title: "Plus — <em>unstoppable</em> study",
      body: "Unlimited hearts · No ads · 11.6k questions",
      pills: [],
      cta: "Upgrade",
      ghost: null,
    },
  },
};

function goPremium() {
  window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }));
}

export function PremiumBanner({ variant = "inline", onGhost, priceNote, offNote }) {
  const lang = useLang();
  const fa = lang === "fa";
  const c = (COPY[lang][variant] || COPY[lang].inline);
  const plans = usePlansToman();
  const monthlyRial = plans?.monthly ?? plans?.monthlyRial ?? plans?.monthly_amount ?? FALLBACK_MONTHLY_RIAL;
  const yearlyRial  = plans?.yearly  ?? plans?.yearlyRial  ?? plans?.yearly_amount  ?? FALLBACK_YEARLY_RIAL;
  const tomanFa = fmtToman(monthlyRial);
  const tomanEn = fmtUSD(monthlyRial);
  const yearlyFa = fmtToman(yearlyRial);
  const yearlyEn = fmtUSD(yearlyRial);
  const savePct = yearlyRial && monthlyRial ? Math.max(0, Math.round((1 - (yearlyRial / 12) / monthlyRial) * 100)) : 0;

  const livePriceFa = `از ${tomanFa} تومان / ماه`;
  const liveOffFa   = yearlyRial ? `سالانه ${yearlyFa} — تا ${savePct || 40}٪ صرفه‌جویی` : "تا ۴۰٪ تخفیف";
  const livePriceEn = `From ${tomanEn} Toman / mo`;
  const liveOffEn   = yearlyRial ? `Yearly ${yearlyEn} — save ${savePct || 40}%` : "Up to 40% off";

  const livePrice = fa ? livePriceFa : livePriceEn;
  const liveOff   = fa ? liveOffFa   : liveOffEn;

  const sizeCls =
    variant === "hero" ? " premium-banner--hero" :
    variant === "mini" ? " premium-banner--compact" :
    variant === "inline" ? " premium-banner--compact" : "";

  const showPrice = variant === "hero";

  return (
    <div className={`premium-banner${sizeCls}`} role="group" aria-label={c.title.replace(/<[^>]*>/g, "")} dir={fa ? "rtl" : "ltr"}>
      <div className="premium-banner__bg" aria-hidden="true" />
      <div className="premium-banner__grid" aria-hidden="true" />
      <div className="premium-banner__orb premium-banner__orb--1" aria-hidden="true" />
      <div className="premium-banner__orb premium-banner__orb--2" aria-hidden="true" />
      <div className="premium-banner__shine" aria-hidden="true" />

      <div className="premium-banner__inner">
        <div className="premium-banner__icon" aria-hidden="true">👑</div>

        <div className="premium-banner__text">
          <span className="premium-banner__kicker">{c.kicker}</span>
          {/* title contains <em> for gradient accent */}
          <h4 className="premium-banner__title" dangerouslySetInnerHTML={{ __html: c.title }} />
          <p className="premium-banner__body">{c.body}</p>

          {c.pills?.length > 0 && (
            <div className="premium-banner__bullets">
              {c.pills.map((p, i) => <span key={i} className="premium-banner__pill">{p}</span>)}
            </div>
          )}

          {showPrice && priceNote !== false && (
            <div className="premium-banner__price">
              <b>{priceNote || livePrice}</b>
              {offNote !== false && <small>{offNote || liveOff}</small>}
            </div>
          )}
        </div>

        <div className="premium-banner__actions">
          <button type="button" className="premium-banner__cta" onClick={goPremium}>
            {c.cta} <span aria-hidden="true">✦</span>
          </button>
          {c.ghost && (
            <button type="button" className="premium-banner__ghost" onClick={onGhost || (() => {})}>
              {c.ghost}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Convenience aliases */
export function PremiumHero(props) { return <PremiumBanner variant="hero" {...props} />; }
export function PremiumInline(props) { return <PremiumBanner variant="inline" {...props} />; }
export function PremiumCard(props) { return <PremiumBanner variant="card" {...props} />; }
export function PremiumMini(props) { return <PremiumBanner variant="mini" {...props} />; }
