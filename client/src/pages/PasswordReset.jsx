/* PasswordReset.jsx — R70. Standalone page at /reset-password.
   • Without ?token= : asks for the account e-mail and always shows the same
     confirmation (the server never reveals whether an account exists).
   • With ?token=    : asks for a new password. The link works once and
     expires after 30 minutes; the server signs out every session on success. */
import { useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";

const ERRORS = {
  invalid_or_expired_token: ["این لینک نامعتبر است یا منقضی شده. یک لینک تازه بخواهید.", "This link is invalid or has expired. Request a new one."],
  "weak password": ["رمز عبور ضعیف است یا در فهرست رمزهای لو رفته است.", "Password is weak or appears in breach lists."],
  too_many_requests: ["درخواست‌های زیاد. یک ساعت بعد دوباره تلاش کنید.", "Too many requests. Try again in an hour."],
};

export default function PasswordReset() {
  const { lang } = useApp();
  const fa = lang !== "en";
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const errText = (code) => {
    const e = ERRORS[code];
    if (e) return fa ? e[0] : e[1];
    return fa ? "خطا در ارتباط با سرور. دوباره تلاش کنید." : "Could not reach the server. Please try again.";
  };

  const sendRequest = async () => {
    setErr(""); setBusy(true);
    try {
      await api.post("/auth/forgot", { email: email.trim(), lang: fa ? "fa" : "en" });
      setDone(true);
    } catch (e) { setErr(errText(e?.data?.error)); }
    finally { setBusy(false); }
  };

  const submitNew = async () => {
    setErr("");
    if (pw.length < 8) { setErr(fa ? "رمز باید حداقل ۸ نویسه باشد." : "Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr(fa ? "دو رمز یکسان نیستند." : "The two passwords do not match."); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset", { token, password: pw });
      setDone(true);
    } catch (e) { setErr(errText(e?.data?.error)); }
    finally { setBusy(false); }
  };

  const wrap = {
    minHeight: "100vh", display: "grid", placeItems: "center", padding: 20,
    background: "var(--bg, #f4f7fb)",
  };
  const card = {
    width: "min(420px, 100%)", background: "#fff", borderRadius: 16, padding: 24,
    boxShadow: "0 12px 40px -24px rgba(38,82,122,.45)", border: "1px solid #dbe3ee",
  };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #c8d3e1", margin: "6px 0 12px", fontSize: "1rem" };

  return (
    <div style={wrap} dir={fa ? "rtl" : "ltr"}>
      <div style={card}>
        <h1 style={{ fontSize: "1.2rem", margin: "0 0 8px" }}>
          {fa ? (token ? "تعیین رمز عبور جدید" : "بازیابی رمز عبور") : (token ? "Choose a new password" : "Reset your password")}
        </h1>

        {done ? (
          <>
            <p style={{ lineHeight: 1.8 }}>
              {token
                ? (fa ? "رمز عبور شما تغییر کرد. اکنون با رمز جدید وارد شوید." : "Your password has been changed. Sign in with the new password.")
                : (fa ? "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی به آن ارسال شده است. لینک ۳۰ دقیقه اعتبار دارد." : "If an account matches this e-mail, a reset link has been sent. The link is valid for 30 minutes.")}
            </p>
            <a href="/" className="btn btn-primary btn-block" style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10 }}>
              {fa ? "ورود به سایت" : "Go to sign-in"}
            </a>
          </>
        ) : token ? (
          <>
            <label>{fa ? "رمز عبور جدید" : "New password"}
              <input style={input} dir="ltr" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label>{fa ? "تکرار رمز عبور" : "Repeat password"}
              <input style={input} dir="ltr" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNew()} />
            </label>
            {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}
            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={submitNew}>
              {fa ? "ذخیره رمز جدید" : "Save new password"}
            </button>
          </>
        ) : (
          <>
            <label>{fa ? "ایمیل حساب" : "Account e-mail"}
              <input style={input} dir="ltr" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendRequest()} />
            </label>
            {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}
            <button type="button" className="btn btn-primary btn-block" disabled={busy || !email.trim()} onClick={sendRequest}>
              {fa ? "ارسال لینک بازیابی" : "Send reset link"}
            </button>
          </>
        )}
        <p style={{ marginTop: 16, fontSize: ".9rem" }}><a href="/">{fa ? "بازگشت به صفحه اصلی" : "Back to home"}</a></p>
      </div>
    </div>
  );
}
