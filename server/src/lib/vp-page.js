/* vp-page.js — copy and layout of the public /VP virtual-patient page.

   The whole page lives in one JSON blob (settings key "vp_page"), edited from
   the admin university section. Every value is normalized on read AND write:
   text is plain (no markup, control characters removed), every string is
   length-capped, and every list is count-capped and drops empty items. A
   stored value therefore can never break the page or grow without bound. */
import { db } from "../db.js";

const KEY = "vp_page";

const LIMIT = { title: 120, line: 400, short: 60, value: 24 };
const MAX = { vitals: 4, chat: 8, steps: 3, features: 6, faq: 6 };
/* Exposed to the admin editor so its inputs enforce the same caps. */
export const VP_PAGE_LIMITS = { ...LIMIT, ...MAX };

const bi = (fa, en) => ({ fa, en });

export const DEFAULT_VP_PAGE = {
  enabled: true,
  headline: bi(
    "بیمار مجازی؛ تشخیص را از یک گفت‌وگو شروع کنید",
    "The virtual patient: start the diagnosis with a conversation",
  ),
  subtitle: bi(
    "هر پرونده یک بیمار با شکایت، سابقه و علائم حیاتی مشخص است. سؤال بپرسید، معاینه و آزمایش سفارش دهید، و تشخیص خود را ثبت کنید. بعد از هر پرونده، بازخورد بالینی دریافت می‌کنید.",
    "Each case is a patient with a complaint, a history and vital signs. Ask questions, order tests and record your diagnosis. You get clinical feedback after every case.",
  ),
  cta_login: bi("ورود با شماره دانشجویی", "Sign in with student number"),
  cta_demo: bi("دیدن یک گفت‌وگوی نمونه", "See a sample conversation"),
  vitals: [
    { label: bi("فشار خون", "Blood pressure"), value: "148/92" },
    { label: bi("ضربان قلب", "Heart rate"), value: "104" },
    { label: bi("تنفس", "Respiratory rate"), value: "22" },
    { label: bi("اکسیژن خون", "SpO2"), value: "94%" },
  ],
  chat: [
    { role: "student", text: bi("سلام. چه چیزی شما را به بیمارستان آورد؟", "Hello. What brought you to the hospital?") },
    { role: "patient", text: bi("از دیروز عصر فشار سنگینی زیر جناغ دارم که به شانه چپم می‌رود.", "Since yesterday evening I've had a heavy pressure under my sternum that goes to my left shoulder.") },
    { role: "student", text: bi("آیا با فعالیت بدتر می‌شود؟", "Does it get worse with activity?") },
    { role: "patient", text: bi("بله، روی پله بدتر می‌شود و با استراحت کم می‌شود.", "Yes, it gets worse on stairs and eases with rest.") },
    { role: "student", text: bi("ECG و تروپونین را درخواست می‌کنم.", "I'm ordering an ECG and troponin.") },
    { role: "patient", text: bi("ممنون. منتظر نتیجه می‌مانم.", "Thank you. I'll wait for the results.") },
  ],
  steps: [
    { title: bi("گفت‌وگو با بیمار", "Talk to the patient"), text: bi("سابقه، علائم و نگرانی بیمار را با سؤال‌های درست و به ترتیب بپرسید.", "Take the history, symptoms and concerns with the right questions, in order.") },
    { title: bi("معاینه و آزمایش", "Examine and order tests"), text: bi("معاینه، آزمایش و تصویربرداری سفارش دهید و نتیجه‌ها را ببینید.", "Order examinations, labs and imaging, then review the results.") },
    { title: bi("تشخیص و بازخورد", "Diagnose and get feedback"), text: bi("تشخیص و برنامه درمان خود را ثبت کنید و گزارش بالینی دریافت کنید.", "Record your diagnosis and plan, then get a clinical report.") },
  ],
  features: [
    { title: bi("شرح حال بالینی", "History taking"), text: bi("سؤال‌های درست را به ترتیب و با همدلی بپرسید.", "Ask the right questions, in order, with empathy.") },
    { title: bi("معاینه فیزیکی", "Physical examination"), text: bi("معاینه‌های کلیدی را انجام دهید و یافته‌ها را ثبت کنید.", "Perform the key examinations and record the findings.") },
    { title: bi("آزمایش و تصویربرداری", "Tests and imaging"), text: bi("فقط آزمایش‌هایی را بخواهید که به تشخیص کمک می‌کنند.", "Request only the tests that help the diagnosis.") },
    { title: bi("تشخیص افتراقی", "Differential diagnosis"), text: bi("فهرست تشخیص‌های محتمل را بسازید و بر اساس شواهد اولویت دهید.", "Build a list of likely diagnoses and rank it by evidence.") },
    { title: bi("ارتباط با بیمار", "Patient communication"), text: bi("واضح توضیح دهید و نگرانی بیمار را جدی بگیرید.", "Explain clearly and take the patient's concerns seriously.") },
    { title: bi("بازخورد بالینی", "Clinical feedback"), text: bi("بعد از هر پرونده نقاط قوت و کمبودهای خود را ببینید.", "After each case, see your strengths and gaps.") },
  ],
  faq: [
    { q: bi("برای ورود باید حساب جدید بسازم؟", "Do I need a new account?"), a: bi("نه. با شماره دانشجویی و رمزی که دانشگاه برایتان ثبت کرده وارد شوید. اگر حساب ندارید، از دانشگاه بخواهید ثبت‌نامتان را انجام دهد.", "No. Sign in with your student number and the password your university registered. If you have no account, ask your university to register you.") },
    { q: bi("بیمار مجازی واقعی است؟", "Is the patient real?"), a: bi("نه. بیمار مجازی یک شبیه‌سازی آموزشی بر پایه پرونده‌های بالینی است و تشخیص پزشکی واقعی نمی‌دهد.", "No. The virtual patient is an educational simulation built from clinical cases. It does not give a real medical diagnosis.") },
    { q: bi("استادم گفت‌وگوهایم را می‌بیند؟", "Can my instructor see my conversations?"), a: bi("بله. گفت‌وگوها و نتیجه پرونده‌ها برای مدرس درس قابل مشاهده است.", "Yes. Your course instructor can review conversations and case results.") },
    { q: bi("رمز عبورم را فراموش کرده‌ام", "I forgot my password"), a: bi("در صفحه ورود گزینه بازیابی رمز عبور را بزنید. اگر کمک لازم داشتید، با پشتیبانی تماس بگیرید.", "Use the password recovery option on the sign-in page. If you need help, contact support.") },
  ],
  login: {
    title: bi("ورود دانشجویان", "Student sign-in"),
    help: bi("شماره دانشجویی و رمزی را وارد کنید که دانشگاه برایتان ثبت کرده است.", "Enter the student number and password your university registered for you."),
    submit: bi("ورود به بیمار مجازی", "Sign in to the virtual patient"),
  },
  // Shown above the sign-in form. Students only get access once their university has registered them.
  access: {
    title: bi("پیش‌نیاز: ثبت‌نام دانشجو در دانشگاه", "Requirement: student registration at your university"),
    body: bi(
      "بیمار مجازی برای دانشجویان دانشگاه‌های همکار است. دانشجو باید پیش از ورود، توسط دانشگاه ثبت‌نام شده باشد؛ آموزش دانشگاه یا مدرس درس این کار را انجام می‌دهد. اگر حساب ندارید، از آموزش دانشگاه خود بخواهید آن را بسازد، سپس با شماره دانشجویی و رمز عبور وارد شوید.",
      "The virtual patient is for students of partner universities. A student must be registered by their university before signing in. The education office or course instructor does this. If you do not have an account, ask your education office to create one, then sign in with your student number and password.",
    ),
  },
  closed: bi("این صفحه فعلاً در دسترس نیست.", "This page is not available right now."),
};

/* Plain text: drop control characters and angle brackets, collapse spaces, cap length. */
const text = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const bilingual = (v, max) => {
  const o = v && typeof v === "object" ? v : {};
  return bi(text(o.fa, max), text(o.en, max));
};
const filled = (b) => Boolean(b.fa || b.en);
// Drop invalid items first, then cap, so blank rows never use up a slot.
const itemsOf = (v, max, map, valid) =>
  (Array.isArray(v) ? v : []).map(map).filter(valid).slice(0, max);
// A field the admin never sent keeps its default; a sent field is normalized by `read`.
const orDefault = (v, def, read) => (v === undefined ? def : read(v));
const pick = (src, key, read) => orDefault(src[key], DEFAULT_VP_PAGE[key], read);

export function normalizeVpPage(input) {
  const src = input && typeof input === "object" ? input : {};
  const loginSrc = src.login && typeof src.login === "object" ? src.login : {};
  const loginDef = DEFAULT_VP_PAGE.login;
  return {
    enabled: orDefault(src.enabled, DEFAULT_VP_PAGE.enabled, (v) => v === true),
    headline: pick(src, "headline", (v) => bilingual(v, LIMIT.title)),
    subtitle: pick(src, "subtitle", (v) => bilingual(v, LIMIT.line)),
    cta_login: pick(src, "cta_login", (v) => bilingual(v, LIMIT.short)),
    cta_demo: pick(src, "cta_demo", (v) => bilingual(v, LIMIT.short)),
    vitals: pick(src, "vitals", (v) => itemsOf(v, MAX.vitals,
      (x) => ({ label: bilingual(x?.label, LIMIT.short), value: text(x?.value, LIMIT.value) }),
      (x) => filled(x.label) && x.value)),
    chat: pick(src, "chat", (v) => itemsOf(v, MAX.chat,
      (x) => ({ role: x?.role === "patient" ? "patient" : "student", text: bilingual(x?.text, LIMIT.line) }),
      (x) => filled(x.text))),
    steps: pick(src, "steps", (v) => itemsOf(v, MAX.steps,
      (x) => ({ title: bilingual(x?.title, LIMIT.short), text: bilingual(x?.text, LIMIT.line) }),
      (x) => filled(x.title))),
    features: pick(src, "features", (v) => itemsOf(v, MAX.features,
      (x) => ({ title: bilingual(x?.title, LIMIT.short), text: bilingual(x?.text, LIMIT.line) }),
      (x) => filled(x.title))),
    faq: pick(src, "faq", (v) => itemsOf(v, MAX.faq,
      (x) => ({ q: bilingual(x?.q, LIMIT.title), a: bilingual(x?.a, LIMIT.line) }),
      (x) => filled(x.q))),
    login: {
      title: orDefault(loginSrc.title, loginDef.title, (v) => bilingual(v, LIMIT.short)),
      help: orDefault(loginSrc.help, loginDef.help, (v) => bilingual(v, LIMIT.line)),
      submit: orDefault(loginSrc.submit, loginDef.submit, (v) => bilingual(v, LIMIT.short)),
    },
    access: {
      title: orDefault(src.access?.title, DEFAULT_VP_PAGE.access.title, (v) => bilingual(v, LIMIT.title)),
      body: orDefault(src.access?.body, DEFAULT_VP_PAGE.access.body, (v) => bilingual(v, LIMIT.line)),
    },
    closed: pick(src, "closed", (v) => bilingual(v, LIMIT.line)),
  };
}

export function getVpPage() {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(KEY);
  let stored = null;
  try { stored = row ? JSON.parse(row.value) : null; } catch { stored = null; }
  return normalizeVpPage(stored);
}

export function saveVpPage(input) {
  const config = normalizeVpPage(input);
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(KEY, JSON.stringify(config));
  return config;
}
