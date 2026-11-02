/* Turn an auth API failure code into a user-facing sentence (fa or en).
   Shared by the sign-in modal and the /VP page. An unknown code returns ""
   so the caller can show its own generic message. */
export function mapAuthError(m, fa) {
  if (m === "email taken") return fa ? "این ایمیل قبلاً ثبت شده است" : "This email is already registered";
  if (m === "invalid email") return fa ? "ایمیل نامعتبر است" : "Invalid email";
  if (m === "weak password") return fa ? "رمز عبور خیلی کوتاه است یا قبلاً لو رفته. در سایت زنده حداقل ۸ نویسه بگذارید." : "Password is too short or appeared in a breach (8+ characters in production).";
  if (m === "signup disabled") return fa ? "ثبت‌نام جدید فعلاً بسته است. اگر حساب دارید، با گوگل یا ایمیل وارد شوید." : "New sign-up is closed. Existing accounts can still sign in.";
  if (m === "email exists unverified") return fa ? "این ایمیل با رمز ثبت شده و هنوز تأیید نشده. اول ایمیل را تأیید کنید، بعد گوگل را وصل کنید." : "This email is already registered and unverified — confirm the mailbox before linking Google.";
  if (m === "google not configured") return fa ? "ورود با گوگل روی این سرور تنظیم نشده است." : "Google sign-in is not configured on this server.";
  if (m === "too_many_attempts") return fa ? "تلاش‌های ورود بیش از حد. کمی بعد دوباره تلاش کنید." : "Too many login attempts. Try again later.";
  // Server/network failures are NOT a wrong password: say so instead of "invalid username or password".
  if (m === "auth_unavailable" || m === "server_error" || m === "network" || m === "timeout" || m === "bad_response" || /^HTTP 5\d\d$/.test(String(m)))
    return fa ? "سرویس ورود موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید." : "Sign-in is temporarily unavailable. Please try again shortly.";
  return "";
}
