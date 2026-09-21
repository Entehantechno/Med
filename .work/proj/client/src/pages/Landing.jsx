import { useEffect, useState } from "react";
import { warm, onIdle } from "../lib/routes-prefetch.js";
import { useApp } from "../context.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../api.js";

/* Marketing landing page — the first thing a logged-out visitor sees.
   Answers "what is this? is it for me? why trust it?" above the fold, then
   guides the visitor toward a single primary action (Start free / sign up). */
export default function Landing({ publicConfig, onGetStarted, onSignIn, onBlog, onStore, authWarmProps }) {
  // intentWarm: handlers that warm the Login chunk on the earliest pointer
  // signal (hover/touchstart/focus) so «ورود»/«ثبت‌نام» open instantly.
  const warmAuth = authWarmProps ? authWarmProps() : {};
  const openStore = onStore || onGetStarted;   // fallback keeps old behaviour

  // The auth form is the overwhelmingly-next destination for a logged-out
  // visitor: warm its (tiny) chunk as soon as the browser is idle so the CTA
  // click is instant even before any hover/focus happens.
  useEffect(() => onIdle(() => warm("login"), 1200), []);
  const { t, tc, siteContent, lang, theme, toggleTheme, toggleLang } = useApp();
  const fa = lang === "fa";
  const [banner, setBanner] = useState(null);      // admin-managed promo banner
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [live, setLive] = useState(null);          // real stats + social proof from DB
  const [scrolled, setScrolled] = useState(false); // header gets a shadow after the hero
  const [menuOpen, setMenuOpen] = useState(false);  // phone menu sheet

  useEffect(() => {
    if (publicConfig) {
      setBanner(publicConfig.banner?.on ? publicConfig.banner : null);
      setStoreEnabled(!!publicConfig.storeEnabled);
      return;
    }
    api.get("/site-content/config").then((c) => {
      setBanner(c.banner?.on ? c.banner : null);
      setStoreEnabled(!!c.storeEnabled);
    }).catch(() => {});
  }, [publicConfig]);
  // real live social proof (stats, testimonials, FAQ, trust badges)
  useEffect(() => {
    api.get(`/site-content/landing?lang=${lang}`).then(setLive).catch(() => {});
  }, [lang]);
  // One header only. It is position:sticky (see .lp-nav); after the visitor
  // scrolls past the hero it gets a "raised" look (shadow) and the primary CTA
  // is emphasised — instead of a second, duplicated fixed bar (the previous
  // design stacked two headers on phones and ate ~25% of the viewport).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const bannerText = banner ? (fa ? banner.text_fa : banner.text_en) || banner.text_fa : "";
  const bannerCta = banner ? (fa ? banner.cta_fa : banner.cta_en) || banner.cta_fa : "";

  // real numbers only — a stat is shown ONLY when the server returns a value for
  // it (i.e. the real count has reached the admin threshold). Anything null/blank
  // is omitted entirely, so the page never shows a fake or placeholder number.
  const s = live?.stats;
  const stats = [
    [s?.learners, tc("landStatLearners")],
    [s?.questions, tc("landStatQuestions")],
    [s?.topics, tc("landStatTopics")],
    [s?.xp, tc("landStatXp")],
  ].filter(([n]) => n != null && n !== "" && n !== "—" && n !== "0");
  const badges = live?.badges || [];
  const faqs = live?.faqs || [];
  const features = [
    ["patient", tc("landF1Title"), tc("landF1Desc")],
    ["flask", tc("landF2Title"), tc("landF2Desc")],
    ["repeat", tc("landF3Title"), tc("landF3Desc")],
    ["trophy", tc("landF4Title"), tc("landF4Desc")],
    ["book", tc("landF5Title"), tc("landF5Desc")],
    ["globe", tc("landF6Title"), tc("landF6Desc")],
  ];
  const steps = [
    ["user", tc("landStep1Title"), tc("landStep1Desc")],
    ["play", tc("landStep2Title"), tc("landStep2Desc")],
    ["chart", tc("landStep3Title"), tc("landStep3Desc")],
  ];
const cmsTestimonials = [1,2,3].map(i=>{const quote=siteContent?.[`${lang}:landTesti${i}`]||""; const name=siteContent?.[`${lang}:landTesti${i}Name`]||""; return quote||name?{id:`cms-${i}`,quote,name,role:"",rating:5}:null}).filter(Boolean);
  const testimonials = cmsTestimonials.length ? cmsTestimonials : (live?.testimonials || []);

  return (
    <div className="landing" data-theme={theme}>
      <a className="skip-link" href="#main-content">{fa ? "پرش به محتوای اصلی" : "Skip to main content"}</a>
      {/* ---- Admin-managed promo banner (top of landing) ---- */}
      {banner && bannerText && (
        <a className="lp-banner" href={banner.url || "#"} style={{ background: banner.bg || "#2f7fd1" }}
          onClick={(e) => { if (!banner.url) { e.preventDefault(); onGetStarted(); } }}>
          <span className="lp-banner-text">📣 {bannerText}</span>
          {bannerCta && <span className="lp-banner-cta">{bannerCta} →</span>}
        </a>
      )}
      {/* ---- Top nav (the ONLY header; sticky, compact on phones) ---- */}
      <header className={`lp-nav${scrolled ? " raised" : ""}`}>
        <div className="lp-brand">
          <span className="lp-logo"><Icon name="cap" size={24} /></span>
          <span className="lp-brand-name">MED School</span>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-icon-btn" onClick={toggleTheme} aria-label={fa ? (theme === "light" ? "حالت تاریک" : "حالت روشن") : (theme === "light" ? "Dark mode" : "Light mode")}>
            <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
          </button>
          <button className="lp-icon-btn" onClick={toggleLang} aria-label={fa ? "تغییر زبان" : "Change language"}>
            <Icon name="globe" size={18} />
          </button>
          {storeEnabled && <button className="lp-btn-store" onClick={openStore}><Icon name="store" size={16} /> {tc("landStore")}</button>}
          {onBlog && <button className="lp-btn-ghost" data-testid="nav-blog" onClick={onBlog}>{tc("landBlog")}</button>}
          <button className="lp-btn-ghost" data-testid="nav-signin" {...warmAuth} onClick={onSignIn}>{tc("landCtaSecondary")}</button>
          <button className="lp-btn-primary" {...warmAuth} onClick={onGetStarted}>{tc("landCtaPrimary")}</button>
          {/* phones: everything except the primary CTA lives in a menu sheet */}
          <button className="lp-icon-btn lp-menu-btn" onClick={() => setMenuOpen(true)} aria-label={fa ? "منو" : "Menu"} aria-expanded={menuOpen} aria-controls="lp-menu-sheet">
            <Icon name="menu" size={20} />
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="lp-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div id="lp-menu-sheet" className="lp-menu-sheet" role="dialog" aria-modal="true" aria-label={fa ? "منو" : "Menu"} onClick={(e) => e.stopPropagation()}>
            <div className="lp-menu-handle" />
            <div className="lp-menu-head">
              <span className="lp-brand"><span className="lp-logo sm"><Icon name="cap" size={18} /></span> MED School</span>
              <button className="lp-icon-btn" onClick={() => setMenuOpen(false)} aria-label={fa ? "بستن" : "Close"}><Icon name="close" size={18} /></button>
            </div>
            <button className="lp-menu-item" {...warmAuth} onClick={() => { setMenuOpen(false); onGetStarted(); }}><Icon name="crown" size={18} /> {tc("landCtaPrimary")}</button>
            <button className="lp-menu-item" data-testid="menu-signin" {...warmAuth} onClick={() => { setMenuOpen(false); onSignIn(); }}><Icon name="user" size={18} /> {tc("landCtaSecondary")}</button>
            {storeEnabled && <button className="lp-menu-item" onClick={() => { setMenuOpen(false); openStore(); }}><Icon name="store" size={18} /> {tc("landStore")}</button>}
            {onBlog && <button className="lp-menu-item" onClick={() => { setMenuOpen(false); onBlog(); }}><Icon name="book" size={18} /> {tc("landBlog")}</button>}
            <div className="lp-menu-row">
              <button className="lp-menu-item" onClick={toggleTheme}><Icon name={theme === "light" ? "moon" : "sun"} size={18} /> {fa ? (theme === "light" ? "حالت تاریک" : "حالت روشن") : (theme === "light" ? "Dark mode" : "Light mode")}</button>
              <button className="lp-menu-item" onClick={toggleLang}><Icon name="globe" size={18} /> {t("otherLang")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Hero ---- */}
      <main id="main-content" className="lp-main" tabIndex="-1">
      <section className="lp-hero" aria-labelledby="landing-hero-title">
        <div className="lp-hero-glow" />
        <div className="lp-hero-inner">
          <div className="lp-badge"><Icon name="medal" size={14} /> {tc("landTrust")}</div>
          <h1 id="landing-hero-title" className="lp-h1">{tc("landHeroTitle")}</h1>
          <p className="lp-sub">{tc("landHeroSub")}</p>
          <div className="lp-cta-row">
            <button className="lp-btn-primary lp-btn-lg" {...warmAuth} onClick={onGetStarted}>
              <Icon name="crown" size={18} /> {tc("landCtaPrimary")}
            </button>
            <button className="lp-btn-outline lp-btn-lg" {...warmAuth} onClick={onSignIn}>{tc("landCtaSecondary")}</button>
          </div>
          {/* trust badges right under the CTA — objection-killers at decision point */}
          {badges.length > 0 && (
            <div className="lp-trust-badges">
              {badges.map((b) => (
                <span className="lp-trust-badge" key={b.id}>
                  <Icon name={b.icon} size={15} /> {b.label}
                </span>
              ))}
            </div>
          )}
          {stats.length > 0 && (
            <div className="lp-stats">
              {stats.map(([n, l]) => (
                <div className="lp-stat" key={l}><div className="lp-stat-n">{n}</div><div className="lp-stat-l">{l}</div></div>
              ))}
            </div>
          )}
        </div>
        {/* mock product preview */}
        <div className="lp-hero-mock" aria-hidden="true">
          <MockPath />
        </div>
      </section>

      {/* ---- Audiences ---- */}
      <section className="lp-section">
        <h2 className="lp-h2">{tc("landAudiencesTitle")}</h2>
        <div className="lp-audiences">
          <div className="lp-aud-card lp-aud-learner">
            <div className="lp-aud-ico" style={{ background: "var(--grad-green)" }}><Icon name="medal" size={26} /></div>
            <h3>{tc("landLearnerTitle")}</h3>
            <p>{tc("landLearnerDesc")}</p>
            <button className="lp-btn-primary" {...warmAuth} onClick={onGetStarted}>{tc("landCtaPrimary")} →</button>
          </div>
          <div className="lp-aud-card lp-aud-uni">
            <div className="lp-aud-ico" style={{ background: "var(--grad-primary)" }}><Icon name="class" size={26} /></div>
            <h3>{tc("landUniTitle")}</h3>
            <p>{tc("landUniDesc")}</p>
            <button className="lp-btn-outline" {...warmAuth} onClick={onSignIn}>{tc("landCtaSecondary")} →</button>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="lp-section lp-features-wrap">
        <h2 className="lp-h2">{tc("landFeaturesTitle")}</h2>
        <div className="lp-features">
          {features.map(([ic, title, desc]) => (
            <div className="lp-feature" key={title}>
              <div className="lp-feature-ico"><Icon name={ic} size={22} /></div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="lp-section">
        <h2 className="lp-h2">{tc("landHowTitle")}</h2>
        <div className="lp-steps">
          {steps.map(([ic, title, desc], i) => (
            <div className="lp-step" key={title}>
              <div className="lp-step-num">{fa ? ["۱", "۲", "۳"][i] : i + 1}</div>
              <div className="lp-step-ico"><Icon name={ic} size={20} /></div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Gamification highlight ---- */}
      <section className="lp-gamify">
        <div className="lp-gamify-text">
          <h2 className="lp-h2" style={{ textAlign: "start" }}>{tc("landGamifyTitle")}</h2>
          <p>{tc("landGamifyDesc")}</p>
          <div className="lp-chips">
            <span className="lp-chip flame"><Icon name="clock" size={15} /> Streak</span>
            <span className="lp-chip xp"><Icon name="medal" size={15} /> XP</span>
            <span className="lp-chip lg"><Icon name="trophy" size={15} /> League</span>
          </div>
        </div>
        <div className="lp-gamify-visual"><MockLeague /></div>
      </section>

      {/* ---- Testimonials (only when the admin has published at least one) ---- */}
      {testimonials.length > 0 && (
      <section className="lp-section">
        <h2 className="lp-h2">{tc("landTestiTitle")}</h2>
        <div className="lp-testimonials">
          {testimonials.map((t, i) => (
            <div className="lp-testi" key={t.id || i}>
              <div className="lp-stars">{"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}</div>
              <p>{t.quote}</p>
              <div className="lp-testi-author">
                <Avatar name={t.name} photo={t.photo} />
                <div className="lp-testi-meta">
                  <div className="lp-testi-name">{t.name}</div>
                  {t.role && <div className="lp-testi-role">{t.role}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ---- FAQ (objection handling) ---- */}
      {faqs.length > 0 && (
        <section className="lp-section lp-faq-wrap">
          <h2 className="lp-h2">{tc("landFaqTitle")}</h2>
          <div className="lp-faqs">
            {faqs.map((f) => <FaqItem key={f.id} q={f.q} a={f.a} />)}
          </div>
        </section>
      )}

      {/* ---- Final CTA ---- */}
      <section className="lp-final">
        <h2>{tc("landFinalTitle")}</h2>
        <p>{tc("landFinalSub")}</p>
        <button className="lp-btn-primary lp-btn-lg" onClick={onGetStarted}>
          <Icon name="crown" size={18} /> {tc("landCtaPrimary")}
        </button>
      </section>

      </main>

      {/* ---- Footer ---- */}
      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="lp-logo"><Icon name="cap" size={20} /></span>
          <span className="lp-brand-name">MED School</span>
        </div>
        <div className="lp-footer-tag">{tc("landFooterTagline")}</div>
        <div className="lp-footer-rights">© {new Date().getFullYear()} MED School — {tc("landRights")}</div>
      </footer>
    </div>
  );
}

/* ---- Testimonial avatar: uploaded photo, else colored initials ---- */
function Avatar({ name, photo }) {
  if (photo) return <img className="lp-avatar" src={photo} alt={name || ""} />;
  const initials = (name || "?")
    .trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  // deterministic color from the name so each person keeps a stable hue
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div className="lp-avatar lp-avatar-initials" style={{ background: `hsl(${h} 60% 29%)` }}>
      {initials}
    </div>
  );
}

/* ---- Collapsible FAQ item ---- */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq ${open ? "open" : ""}`}>
      <button className="lp-faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{q}</span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={18} />
      </button>
      {open && <div className="lp-faq-a">{a}</div>}
    </div>
  );
}

/* ---- lightweight inline mock visuals (no external assets) ---- */
function MockPath() {
  const nodes = [
    { done: true }, { done: true }, { active: true }, {}, {},
  ];
  return (
    <div className="mock-card">
      <div className="mock-hud">
        <span className="mock-pill flame">🔥 12</span>
        <span className="mock-pill xp">★ 340</span>
        <span className="mock-pill heart">❤ 5</span>
      </div>
      <div className="mock-path">
        {nodes.map((n, i) => (
          <div key={i} className={`mock-node ${n.done ? "done" : ""} ${n.active ? "active" : ""}`}
            style={{ marginInlineStart: `${(i % 2 === 0 ? 0 : 60)}px` }}>
            {n.done ? "✓" : n.active ? "▶" : "★"}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLeague() {
  const rows = [
    ["🥇", "سینا", 765], ["🥈", "نگار", 650], ["🥉", "شما", 620], ["4", "رضا", 540],
  ];
  return (
    <div className="mock-card mock-league">
      <div className="mock-league-title">🏆 لیگ نقره</div>
      {rows.map(([m, name, xp], i) => (
        <div className={`mock-lg-row ${name === "شما" ? "me" : ""}`} key={i}>
          <span className="mock-lg-rank">{m}</span>
          <span className="mock-lg-name">{name}</span>
          <span className="mock-lg-xp">{xp} XP</span>
        </div>
      ))}
    </div>
  );
}
