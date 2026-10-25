/* mailer.js — best-effort email sending for verification links.
   Uses nodemailer + SMTP if configured via env; otherwise degrades gracefully:
   in dev/local (no SMTP) it logs the link to the console and the caller can
   auto-verify so signup still works without an email server. */
let transporter = null;
let ready = null;

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "MED School <no-reply@medschool.local>";
export const APP_URL = process.env.APP_URL || "http://localhost:4000";

export function mailConfigured() { return !!(SMTP_HOST && SMTP_USER); }

async function getTransport() {
  if (!mailConfigured()) return null;
  if (ready) return transporter;
  try {
    const nodemailer = (await import("nodemailer")).default;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    ready = true;
    return transporter;
  } catch { return null; } // nodemailer not installed
}

/* Send the verification email. Returns { sent: bool }.
   When SMTP isn't set up, returns { sent:false } and the caller auto-verifies. */
export async function sendVerificationEmail(to, token, lang = "fa") {
  const link = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const t = await getTransport();
  if (!t) {
    // no SMTP → log for the operator, signal not-sent so signup can proceed
    console.log(`✉️  [dev] Email verification link for ${to}: ${link}`);
    return { sent: false, link };
  }
  const fa = lang !== "en";
  const subject = fa ? "تأیید ایمیل — MED School" : "Verify your email — MED School";
  const html = fa
    ? `<div dir="rtl" style="font-family:Tahoma,sans-serif"><h2>خوش آمدید به MED School 🎓</h2>
       <p>برای فعال‌سازی حساب خود روی دکمه زیر بزنید:</p>
       <p><a href="${link}" style="background:#26527a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">تأیید ایمیل</a></p>
       <p style="color:#888;font-size:12px">اگر شما ثبت‌نام نکرده‌اید، این ایمیل را نادیده بگیرید.</p></div>`
    : `<div style="font-family:sans-serif"><h2>Welcome to MED School 🎓</h2>
       <p>Click below to activate your account:</p>
       <p><a href="${link}" style="background:#26527a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Verify email</a></p>
       <p style="color:#888;font-size:12px">If you didn't sign up, ignore this email.</p></div>`;
  try {
    await t.sendMail({ from: MAIL_FROM, to, subject, html });
    return { sent: true, link };
  } catch (e) {
    console.log(`✉️  Email send failed (${e.message}); link: ${link}`);
    return { sent: false, link };
  }
}
