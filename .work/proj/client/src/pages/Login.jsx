import { useState } from "react";
import { useApp } from "../context.jsx";
import { useScrollLock } from "../utils/useScrollLock.js";
import { TopBar } from "../components/UI.jsx";
import Icon from "../components/Icon.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { PROVINCES } from "../data/provinces.js";
import { warm } from "../lib/routes-prefetch.js";

function LoginModalShell({ onBackHome, children }) {
  useScrollLock(true);
  return (
    <div className="login-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && onBackHome) onBackHome(); }}>
      {children}
    </div>
  );
}

export default function Login({ initialMode = "login", onBackHome, asModal = false }) {
  const { t, lang, login, register, googleLogin } = useApp();
  const [mode, setMode] = useState(initialMode); // login | signup
  const [identifier, setIdentifier] = useState(""); // email or username (login)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [province, setProvince] = useState("تهران");
  const [program, setProgram] = useState("preint"); // which course to join
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const fa = lang === "fa";

  const mapAuthError = (m) => {
    if (m === "email taken") return fa ? "این ایمیل قبلاً ثبت شده است" : "This email is already registered";
    if (m === "invalid email") return fa ? "ایمیل نامعتبر است" : "Invalid email";
    if (m === "weak password") return fa ? "رمز عبور خیلی کوتاه است یا قبلاً لو رفته. در سایت زنده حداقل ۸ نویسه بگذارید." : "Password is too short or appeared in a breach (8+ characters in production).";
    if (m === "signup disabled") return fa ? "ثبت‌نام جدید فعلاً بسته است. اگر حساب دارید، با گوگل یا ایمیل وارد شوید." : "New sign-up is closed. Existing accounts can still sign in.";
    if (m === "email exists unverified") return fa ? "این ایمیل با رمز ثبت شده و هنوز تأیید نشده. اول ایمیل را تأیید کنید، بعد گوگل را وصل کنید." : "This email is already registered and unverified — confirm the mailbox before linking Google.";
    if (m === "google not configured") return fa ? "ورود با گوگل روی این سرور تنظیم نشده است." : "Google sign-in is not configured on this server.";
    if (m === "too_many_attempts") return fa ? "تلاش‌های ورود بیش از حد. کمی بعد دوباره تلاش کنید." : "Too many login attempts. Try again later.";
    return "";
  };

  const submit = async () => {
    setErr(""); setNotice("");
    if (mode === "login") {
      if (!identifier.trim() || !password) {
        setErr(fa ? "ایمیل/نام کاربری و رمز را وارد کنید." : "Enter your email/username and password.");
        return;
      }
    } else {
      if (!email.trim() || !password) {
        setErr(fa ? "ایمیل و رمز عبور لازم است." : "Email and password are required.");
        return;
      }
      if (password.length < 8) {
        setErr(fa ? "رمز عبور باید حداقل ۸ نویسه باشد (در محیط آزمایش حداقل ۴)." : "Use at least 8 characters (4 in the test environment).");
        return;
      }
    }
    setBusy(true);
    // While the login POST is in flight, warm both post-login shells so the
    // login→home hand-off has ZERO chunk-download pause.
    warm("studentHome"); warm("learnApp");
    try {
      if (mode === "login") {
        await login(identifier.trim(), password);
      } else {
        const { emailSent } = await register({ email: email.trim(), password, name_fa: name || email.trim(), name_en: name || email.trim(), province, program, lang });
        if (emailSent) setNotice(fa ? "ایمیل تأیید برایتان ارسال شد. صندوق ورودی را بررسی کنید." : "A verification email was sent — check your inbox.");
      }
    } catch (e) {
      const mapped = mapAuthError(e.message);
      if (mode === "login") setErr(mapped || t("loginError"));
      else setErr(mapped || (fa ? "ثبت‌نام ناموفق بود" : "Sign-up failed"));
    } finally { setBusy(false); }
  };

  const onGoogle = async (credential, nonce) => {
    setErr(""); setBusy(true);
    warm("studentHome"); warm("learnApp");
    try { await googleLogin(credential, { nonce, program, province }); }
    catch (e) { setErr(mapAuthError(e.message) || (fa ? "ورود با گوگل ناموفق بود" : "Google sign-in failed")); }
    finally { setBusy(false); }
  };

  // The inner card content is identical whether shown as a full page or a modal
  // popover on the landing. `asModal` swaps the outer wrapper only.
  const card = (
        <div className="card login-card" style={{ maxWidth: 420 }}>
          {asModal && onBackHome && (
            <button className="login-modal-close" aria-label={t("close") || "بستن"} onClick={onBackHome}>
              <Icon name="close" size={18} />
            </button>
          )}
          <div className="logo"><Icon name="cap" size={28} /></div>
          <h2 id="login-title">{mode === "login" ? t("login") : t("createAccount")}</h2>
          {mode === "signup" && <div className="muted small mt8">{t("learnerTagline")}</div>}
          {err && <div className="err-banner mt8">{err}</div>}
          {notice && <div className="ok-banner mt8">{notice}</div>}

          <GoogleButton onCredential={onGoogle} onError={() => {}} promptOneTap={mode === "login"} />
          <div className="or-divider"><span>{fa ? "یا با ایمیل" : "or with email"}</span></div>

          {/* A real <form> so the browser (Google Password Manager) offers to
              save/autofill credentials. Submit is handled in JS. */}
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {mode === "signup" ? (
            <>
              <div className="field mt16" style={{ textAlign: "start" }}>
                <label>{t("fullName")}</label>
                <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field" style={{ textAlign: "start" }}>
                <label>{t("email")}</label>
                <input data-testid="signup-email" type="email" dir="ltr" name="email" autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="you@example.com" />
              </div>
              <div className="field" style={{ textAlign: "start" }}>
                <label>{t("password")}</label>
                <div className="pw-wrap">
                  <input dir="ltr" data-testid="login-password" type={showPw ? "text" : "password"} name="new-password" autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
                  <button type="button" className="pw-toggle" aria-label={showPw ? (fa ? "پنهان کردن رمز" : "Hide password") : (fa ? "نمایش رمز" : "Show password")} onClick={() => setShowPw((v) => !v)}>{showPw ? (fa ? "پنهان" : "Hide") : (fa ? "نمایش" : "Show")}</button>
                </div>
                <div className="small muted">{fa ? "حداقل ۸ نویسه (در این نسخه آزمایشی ۴ نویسه هم پذیرفته می‌شود)." : "At least 8 characters (4 is accepted in this test build)."}</div>
              </div>
              <div className="field" style={{ textAlign: "start" }}>
                <label>{t("province")}</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)}>
                  {PROVINCES.map((p) => <option key={p.fa} value={p.fa}>{fa ? p.fa : p.en}</option>)}
                </select>
              </div>
              {/* Which course does the learner want to join? (Duolingo-style) */}
              <div className="field" style={{ textAlign: "start" }}>
                <label>{t("chooseProgram")}</label>
                <div className="program-choice">
                  <button type="button" className={`program-choice-opt ${program === "preint" ? "active" : ""}`} onClick={() => setProgram("preint")}>
                    <span className="pc-emoji">🩺</span> {t("programPreint")}
                  </button>
                  <button type="button" className={`program-choice-opt ${program === "basic" ? "active" : ""}`} onClick={() => setProgram("basic")}>
                    <span className="pc-emoji">🔬</span> {t("programBasic")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="field mt16" style={{ textAlign: "start" }}>
                <label>{t("emailOrUsername")}</label>
                <input data-testid="login-username" name="username" autoComplete="username"
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
              </div>
              <div className="field" style={{ textAlign: "start" }}>
                <label>{t("password")}</label>
                <div className="pw-wrap">
                  <input dir="ltr" data-testid="login-password" type={showPw ? "text" : "password"} name="password" autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
                  <button type="button" className="pw-toggle" aria-label={showPw ? (fa ? "پنهان کردن رمز" : "Hide password") : (fa ? "نمایش رمز" : "Show password")} onClick={() => setShowPw((v) => !v)}>{showPw ? (fa ? "پنهان" : "Hide") : (fa ? "نمایش" : "Show")}</button>
                </div>
              </div>
            </>
          )}

          <button data-testid="login-submit" type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "…" : (mode === "login" ? t("enter") : t("signup"))}
          </button>
          </form>

          <div className="mt16" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {mode === "login" ? (
              <button className="btn btn-accent btn-block" onClick={() => { setMode("signup"); setErr(""); setNotice(""); }}>
                <Icon name="crown" size={16} /> {t("signupAsLearner")}
              </button>
            ) : (
              <button className="btn btn-ghost btn-block" onClick={() => { setMode("login"); setErr(""); setNotice(""); }}>
                {t("haveAccount")} {t("login")}
              </button>
            )}
          </div>

          {onBackHome && !asModal && (
            <button className="btn btn-ghost btn-sm btn-block mt16" onClick={onBackHome}>
              <Icon name="logout" size={14} /> {t("backToHome")}
            </button>
          )}
        </div>
  );

  // Modal variant: a small popover centred over the (still-visible) landing.
  // Clicking the dimmed backdrop or the ✕ closes it. The overlay itself is the
  // scroller so a tall signup form always moves, even on short phones.
  if (asModal) {
    return (
      <LoginModalShell onBackHome={onBackHome}>
        <div className="login-modal-shell" role="dialog" aria-modal="true" aria-labelledby="login-title">
          {card}
        </div>
      </LoginModalShell>
    );
  }

  // Full-page variant (used for the standalone /login route, maintenance, etc.)
  return (
    <div className="app">
      <TopBar onHome={() => { if (onBackHome) onBackHome(); }} />
      <div className="center-screen">
        {card}
      </div>
    </div>
  );
}
