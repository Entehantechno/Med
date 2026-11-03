/* VirtualPatientPage.jsx — the public /VP page. It presents the virtual patient
   and signs a student in with their student number. All copy comes from the
   admin config (GET /site-content/vp-page). Layout is inline styles plus one
   Web Animations sequence on load, so the page adds no stylesheet to the CSS
   budget. Motion is skipped under prefers-reduced-motion. */
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { warm } from "../lib/routes-prefetch.js";
import { mapAuthError } from "../lib/auth-errors.js";
import { prefersReducedMotion } from "../lib/motion.js";

const C = {
  ink: "#06101f",
  glass: "rgba(12,26,50,.72)",
  line: "rgba(150,186,240,.2)",
  text: "#eaf1ff",
  muted: "#a9bbd9",
  blue: "#7ab8ff",
  green: "#43d9a0",
  danger: "#ff9b9b",
};
const EASE = "cubic-bezier(.2,.7,.2,1)";
const FEATURE_ICONS = ["chat", "stethoscope", "xray", "brain", "heart", "medal"];
const WIDE = "(min-width: 880px)";

const UI = {
  fa: {
    back: "بازگشت به MED School",
    skip: "رفتن به فرم ورود",
    switchLang: "English",
    live: "گفت‌وگوی نمونه",
    student: "دانشجو",
    patient: "بیمار",
    stepsTitle: "چطور کار می‌کند؟",
    featuresTitle: "چه مهارت‌هایی تمرین می‌کنید؟",
    faqTitle: "پرسش‌های متداول",
    studentNo: "شماره دانشجویی",
    password: "رمز عبور",
    showPw: "نمایش رمز عبور",
    hidePw: "پنهان کردن رمز عبور",
    busy: "در حال ورود…",
    needNo: "شماره دانشجویی را وارد کنید.",
    needPw: "رمز عبور را وارد کنید.",
    wrong: "شماره دانشجویی یا رمز عبور درست نیست.",
    retry: "تلاش دوباره",
    loadFailed: "بارگذاری صفحه انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
    footer: "MED School · آموزش پزشکی با پرونده‌های بالینی",
  },
  en: {
    back: "Back to MED School",
    skip: "Skip to sign-in",
    switchLang: "فارسی",
    live: "Sample conversation",
    student: "Student",
    patient: "Patient",
    stepsTitle: "How it works",
    featuresTitle: "What you practice",
    faqTitle: "Frequently asked questions",
    studentNo: "Student number",
    password: "Password",
    showPw: "Show password",
    hidePw: "Hide password",
    busy: "Signing in…",
    needNo: "Enter your student number.",
    needPw: "Enter your password.",
    wrong: "Student number or password is incorrect.",
    retry: "Try again",
    loadFailed: "The page could not load. Check your connection and try again.",
    footer: "MED School · Medical education with clinical cases",
  },
};

// Bilingual field: the active language, then the other one, so a half-filled
// admin entry still shows something.
const tx = (b, lang) => (b ? b[lang] || b.fa || b.en || "" : "");

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

// One-shot entrance. Skipped entirely under reduced motion, so content is simply shown.
function playOnce(el, frames, options) {
  if (!el || prefersReducedMotion()) return;
  el.animate(frames, { fill: "both", easing: EASE, ...options });
}

const pageStyle = {
  minHeight: "100dvh",
  color: C.text,
  background: `radial-gradient(60% 50% at 85% 0%, rgba(67,217,160,.16), transparent 70%), radial-gradient(55% 45% at 5% 25%, rgba(122,184,255,.18), transparent 70%), ${C.ink}`,
  fontFamily: "inherit",
  colorScheme: "dark",
};
const wrap = (wide) => ({ maxWidth: 1120, margin: "0 auto", paddingLeft: wide ? 32 : 18, paddingRight: wide ? 32 : 18 });
const h2Style = { margin: "0 0 20px", fontSize: 24, fontWeight: 800, lineHeight: 1.6, fontFamily: "var(--font-display, inherit)" };
const glass = { background: C.glass, border: `1px solid ${C.line}`, borderRadius: 20 };
const linkBtn = (primary) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "12px 22px", touchAction: "manipulation",
  borderRadius: 14, fontWeight: 800, fontSize: 16, textDecoration: "none", color: primary ? "#04111f" : C.text,
  background: primary ? `linear-gradient(120deg, ${C.blue}, ${C.green})` : "transparent",
  border: primary ? "none" : `1px solid ${C.line}`,
});
const inputStyle = {
  width: "100%", minHeight: 50, boxSizing: "border-box", padding: "12px 14px", borderRadius: 14,
  border: `1px solid ${C.line}`, background: "rgba(255,255,255,.05)", color: C.text, fontSize: 16,
};
const fieldLabel = { display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700, color: C.muted };

function Monitor({ chat, vitals, lang, ui }) {
  const bubbleRefs = useRef([]);
  const ecgRef = useRef(null);
  const drawEcg = !prefersReducedMotion();

  useEffect(() => {
    bubbleRefs.current.forEach((el, i) => playOnce(el,
      [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
      { duration: 480, delay: 900 + i * 700 }));
    playOnce(ecgRef.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500 });
  }, []);

  return (
    <div style={{ ...glass, padding: 20, boxShadow: "0 30px 80px -30px rgba(67,217,160,.35)", backgroundImage: "linear-gradient(rgba(150,186,240,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(150,186,240,.06) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10 }}>
        {vitals.map((v, i) => (
          <div key={i} style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(6,16,31,.6)", border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 12, color: C.muted }}>{tx(v.label, lang)}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.green, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: "start" }}>{v.value}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 600 90" width="100%" height="84" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ display: "block", margin: "14px 0" }}>
        <path ref={ecgRef} pathLength="1" d="M0 50 L120 50 L135 50 L145 20 L155 80 L165 40 L175 50 L300 50 L315 50 L325 18 L335 82 L345 44 L355 50 L600 50"
          fill="none" stroke={C.green} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          style={drawEcg ? { strokeDasharray: 1, strokeDashoffset: 0 } : undefined} />
      </svg>
      <div role="list" aria-label={ui.live} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {chat.map((m, i) => {
          const isPatient = m.role === "patient";
          return (
            <div key={i} role="listitem" ref={(el) => { bubbleRefs.current[i] = el; }}
              style={{
                maxWidth: "86%", padding: "10px 14px", borderRadius: 16, lineHeight: 1.7, fontSize: 15,
                alignSelf: isPatient ? "flex-end" : "flex-start",
                background: isPatient ? "rgba(255,255,255,.05)" : "rgba(122,184,255,.16)",
                border: `1px solid ${isPatient ? C.line : "rgba(122,184,255,.35)"}`,
              }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{isPatient ? ui.patient : ui.student}</div>
              <div>{tx(m.text, lang)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoginCard({ cfg, lang, ui, wide }) {
  const { login } = useApp();
  const [studentNo, setStudentNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fa = lang === "fa";

  const submit = async (e) => {
    e.preventDefault();
    const no = studentNo.trim();
    if (!no) { setErr(ui.needNo); return; }
    if (!password) { setErr(ui.needPw); return; }
    setErr("");
    setBusy(true);
    // Warm the post-login shells while the request is in flight (same as the sign-in modal).
    warm("studentHome"); warm("learnApp");
    try {
      // Success unmounts this page: App renders the signed-in shell and drops /VP from the URL.
      await login(no, password);
    } catch (ex) {
      setErr(mapAuthError(ex.message, fa) || ui.wrong);
      setBusy(false);
    }
  };

  return (
    <section id="vp-login" aria-labelledby="vp-login-title" style={{ ...glass, padding: wide ? 32 : 22, maxWidth: 480, margin: "0 auto" }}>
      <h2 id="vp-login-title" style={h2Style}>{tx(cfg.login.title, lang)}</h2>
      <aside aria-labelledby="vp-access-title" style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 12, alignItems: "start", padding: 14, marginBottom: 20, borderRadius: 14, border: "1px solid rgba(122,184,255,.35)", background: "rgba(122,184,255,.08)" }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(122,184,255,.16)", color: C.blue }}>
          <Icon name="idcard" size={20} />
        </span>
        <div>
          <h3 id="vp-access-title" style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, lineHeight: 1.6 }}>{tx(cfg.access.title, lang)}</h3>
          <p style={{ margin: 0, color: C.muted, lineHeight: 1.8, fontSize: 15 }}>{tx(cfg.access.body, lang)}</p>
        </div>
      </aside>
      <p id="vp-login-help" style={{ margin: "0 0 22px", color: C.muted, lineHeight: 1.8 }}>{tx(cfg.login.help, lang)}</p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 16 }}>
        <div>
          <label htmlFor="vp-student-no" style={fieldLabel}>{ui.studentNo}</label>
          <input id="vp-student-no" name="username" type="text" inputMode="numeric" autoComplete="username" dir="ltr"
            value={studentNo} onChange={(e) => setStudentNo(e.target.value)}
            aria-invalid={Boolean(err) && !studentNo.trim()} aria-describedby="vp-login-help vp-login-err"
            style={inputStyle} />
        </div>
        <div>
          <label htmlFor="vp-password" style={fieldLabel}>{ui.password}</label>
          <div style={{ position: "relative" }}>
            <input id="vp-password" name="password" type={showPw ? "text" : "password"} autoComplete="current-password" dir="ltr"
              value={password} onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(err) && !password}
              aria-describedby="vp-login-err"
              style={{ ...inputStyle, paddingInlineEnd: 56 }} />
            <button type="button" aria-label={showPw ? ui.hidePw : ui.showPw} aria-pressed={showPw}
              onClick={() => setShowPw((v) => !v)}
              style={{ position: "absolute", insetInlineEnd: 4, top: "50%", transform: "translateY(-50%)", minWidth: 44, minHeight: 44, background: "none", border: "none", color: C.muted, cursor: "pointer", display: "grid", placeItems: "center", touchAction: "manipulation" }}>
              <Icon name={showPw ? "eyeOff" : "eye"} size={20} />
            </button>
          </div>
        </div>
        <div id="vp-login-err" role="alert" style={{ minHeight: 22, color: C.danger, fontSize: 14, lineHeight: 1.6 }}>{err}</div>
        <button type="submit" disabled={busy} style={{ ...linkBtn(true), width: "100%", border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? ui.busy : tx(cfg.login.submit, lang)}
        </button>
      </form>
    </section>
  );
}

function Content({ cfg, lang, ui, wide }) {
  const heroCopy = useRef(null);
  useEffect(() => {
    playOnce(heroCopy.current, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 700 });
  }, []);

  const sectionPad = { paddingTop: wide ? 64 : 40, paddingBottom: wide ? 64 : 40 };
  const stepCols = { display: "grid", gridTemplateColumns: wide ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: 16, listStyle: "none", padding: 0, margin: 0 };
  const featureCols = { display: "grid", gridTemplateColumns: wide ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: 14, listStyle: "none", padding: 0, margin: 0 };

  return (
    <main id="vp-main">
      <section style={{ ...wrap(wide), display: "grid", gridTemplateColumns: wide ? "minmax(0, 1.05fr) minmax(0, .95fr)" : "1fr", gap: wide ? 48 : 28, alignItems: "center", paddingTop: wide ? 56 : 28, paddingBottom: wide ? 64 : 40 }}>
        <div ref={heroCopy}>
          <h1 style={{ margin: "0 0 18px", fontSize: wide ? 48 : 30, lineHeight: lang === "fa" ? 1.6 : 1.2, fontWeight: 800, textWrap: "balance", fontFamily: "var(--font-display, inherit)" }}>
            {tx(cfg.headline, lang)}
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: wide ? 18 : 16, lineHeight: 1.9, color: C.muted, maxWidth: 560 }}>{tx(cfg.subtitle, lang)}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <a href="#vp-login" style={linkBtn(true)}>{tx(cfg.cta_login, lang)}</a>
            <a href="#vp-sample" style={linkBtn(false)}>{tx(cfg.cta_demo, lang)}</a>
          </div>
        </div>
        <div id="vp-sample">
          <Monitor chat={cfg.chat} vitals={cfg.vitals} lang={lang} ui={ui} />
        </div>
      </section>

      <section aria-labelledby="vp-steps-title" style={{ ...wrap(wide), ...sectionPad }}>
        <h2 id="vp-steps-title" style={h2Style}>{ui.stepsTitle}</h2>
        <ol style={stepCols}>
          {cfg.steps.map((s, i) => (
            <li key={i} style={{ ...glass, padding: 22 }}>
              <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", marginBottom: 14, background: "rgba(67,217,160,.14)", color: C.green, fontWeight: 800 }}>
                {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(i + 1)}
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>{tx(s.title, lang)}</h3>
              <p style={{ margin: 0, color: C.muted, lineHeight: 1.8 }}>{tx(s.text, lang)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="vp-features-title" style={{ ...wrap(wide), ...sectionPad }}>
        <h2 id="vp-features-title" style={h2Style}>{ui.featuresTitle}</h2>
        <ul style={featureCols}>
          {cfg.features.map((f, i) => (
            <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 4px", borderTop: `1px solid ${C.line}` }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(122,184,255,.12)", color: C.blue }}>
                <Icon name={FEATURE_ICONS[i % FEATURE_ICONS.length]} size={20} />
              </span>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800 }}>{tx(f.title, lang)}</h3>
                <p style={{ margin: 0, color: C.muted, lineHeight: 1.8 }}>{tx(f.text, lang)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={tx(cfg.login.title, lang)} style={{ ...wrap(wide), ...sectionPad }}>
        <LoginCard cfg={cfg} lang={lang} ui={ui} wide={wide} />
      </section>

      <section aria-labelledby="vp-faq-title" style={{ ...wrap(wide), ...sectionPad, paddingTop: 0 }}>
        <h2 id="vp-faq-title" style={h2Style}>{ui.faqTitle}</h2>
        <div style={{ maxWidth: 780 }}>
          {cfg.faq.map((item, i) => (
            <details key={i} style={{ borderTop: `1px solid ${C.line}`, padding: "4px 0" }}>
              <summary style={{ cursor: "pointer", minHeight: 48, display: "flex", alignItems: "center", fontWeight: 700, fontSize: 16 }}>{tx(item.q, lang)}</summary>
              <p style={{ margin: "0 0 14px", color: C.muted, lineHeight: 1.9 }}>{tx(item.a, lang)}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function VirtualPatientPage() {
  const { lang, toggleLang } = useApp();
  const [cfg, setCfg] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [skipShown, setSkipShown] = useState(false);
  const wide = useWide();
  const fa = lang === "fa";
  const ui = UI[fa ? "fa" : "en"];

  useEffect(() => {
    let alive = true;
    setFailed(false);
    api.get("/site-content/vp-page")
      .then((d) => { if (alive) setCfg(d.config); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [attempt]);

  useEffect(() => {
    if (!cfg) return undefined;
    const previous = document.title;
    document.title = `${tx(cfg.headline, lang)} · MED School`;
    return () => { document.title = previous; };
  }, [cfg, lang]);

  const navBtn = { minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent", color: C.text, cursor: "pointer", fontWeight: 700, fontSize: 14, touchAction: "manipulation" };

  return (
    <div dir={fa ? "rtl" : "ltr"} lang={lang} style={pageStyle}>
      <a href="#vp-login" onFocus={() => setSkipShown(true)} onBlur={() => setSkipShown(false)}
        style={{ position: "absolute", top: 8, insetInlineStart: 8, zIndex: 10, padding: "10px 14px", borderRadius: 10, background: C.blue, color: "#04111f", fontWeight: 800, textDecoration: "none", transform: skipShown ? "none" : "translateY(-200%)" }}>
        {ui.skip}
      </a>
      <header style={{ ...wrap(wide), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 18 }}>
        <a href="/" style={{ color: C.text, textDecoration: "none", fontWeight: 800, fontSize: 18 }}>MED School</a>
        <button type="button" onClick={toggleLang} style={navBtn}>{ui.switchLang}</button>
      </header>

      {!cfg && !failed && <div aria-busy="true" style={{ minHeight: "70dvh" }} />}
      {failed && (
        <div role="alert" style={{ ...wrap(wide), paddingTop: 80, paddingBottom: 80, textAlign: "center" }}>
          <p style={{ color: C.muted, lineHeight: 1.8 }}>{ui.loadFailed}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} style={navBtn}>{ui.retry}</button>
        </div>
      )}
      {cfg && !cfg.enabled && (
        <div style={{ ...wrap(wide), paddingTop: 80, paddingBottom: 80, textAlign: "center" }}>
          <p style={{ color: C.muted, fontSize: 18 }}>{tx(cfg.closed, lang)}</p>
        </div>
      )}
      {cfg?.enabled && <Content cfg={cfg} lang={lang} ui={ui} wide={wide} />}

      <footer style={{ ...wrap(wide), paddingTop: 40, paddingBottom: "calc(56px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.line}`, marginTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, color: C.muted, fontSize: 14 }}>
        <span>{ui.footer}</span>
        <a href="/" style={{ color: C.blue }}>{ui.back}</a>
      </footer>
    </div>
  );
}
