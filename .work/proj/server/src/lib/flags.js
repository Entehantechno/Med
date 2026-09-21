/* flags.js — global feature flags. Seeded with sensible defaults; admins toggle them.
   Learner/teacher routes can check isEnabled() to gate features platform-wide. */
import { db, persistNow } from "../db.js";

export const DEFAULT_FLAGS = [
  ["learner_signup", "ثبت‌نام آزاد کاربران رقابتی", "Public learner sign-up"],
  ["challenges", "چالش‌های دونفره", "1v1 challenges"],
  ["leagues", "لیگ‌های هفتگی", "Weekly leagues"],
  ["ads", "نمایش تبلیغات", "Show ads"],
  ["premium", "فروش پریمیوم", "Premium plans"],
  ["push", "نوتیفیکیشن مرورگر", "Browser push"],
  ["srs_review", "مرور تکرار فاصله‌دار", "Spaced-repetition review"],
  ["learner_cards", "ساخت فلش‌کارت توسط کاربر", "Learner-authored cards"],
  ["virtual_patient", "بیمار مجازی", "Virtual patient"],
  ["drawing_assist", "دستیار پیشنهاد نمرهٔ نقاشی (تحلیل پوشش/IoU — فقط پیشنهادی، تصمیم با استاد)", "Drawing score assist (coverage/IoU — suggested only)"],
  ["exam_sim", "شبیه‌ساز آزمون", "Exam simulator"],
  ["mindmap", "نقشه ذهنی درس‌ها", "Topic mind-maps"],
  ["study_plan", "برنامه مطالعاتی هوشمند", "Smart study plan"],
  ["community", "کارت‌های اشتراکی جامعه", "Community decks"],
  ["mnemonics", "منمونیک تصویری", "Visual mnemonics"],
  ["store", "فروشگاه محصولات آموزشی", "Course store"],
  ["friends", "سیستم دوستان (استریک و چالش دوستانه)", "Friends (friend streak & quest)"],
  ["smart_practice", "هاب تمرین هوشمند نقاط ضعف", "Smart weak-area practice hub"],
  ["support", "پشتیبانی و چت درون‌برنامه‌ای", "In-app support chat"],
  ["onboarding", "چک‌لیست شروع سریع (آنبوردینگ)", "Getting-started onboarding checklist"],
  ["help_center", "مرکز راهنما (سوالات متداول)", "Help center (FAQ)"],
  ["placement", "آزمون تعیین سطح ورودی", "Entry placement test"],
  ["group_purchase", "خرید گروهی (تخفیف حجمی)", "Group purchase (volume discount)"],
  ["dx_challenge", "چالش تشخیص روز", "Daily Diagnosis Challenge"],
  ["referral", "دعوت از دوستان (پاداش دوطرفه)", "Refer-a-friend (double-sided rewards)"],
  ["social_share", "اشتراک‌گذاری اجتماعی و استوری", "Social sharing & story cards"],
  ["smart_reminders", "یادآورهای هوشمند (حفظ استریک و بازگشت)", "Smart reminders (streak & win-back)"],
  ["pwa_install", "پیشنهاد نصب اپ (افزودن به صفحهٔ اصلی)", "App install prompt (add to home screen)"],
  ["seo", "بهینه‌سازی موتور جستجو (متا، Schema، Sitemap)", "SEO (meta tags, schema, sitemap)"],
  ["blog", "وبلاگ و مقالات پزشکی", "Medical education blog"],
  ["certificates", "گواهی‌نامهٔ پایان دوره (قابل استعلام)", "Completion certificates (verifiable)"],
  ["checkpoint", "آزمون Checkpoint بخش (تجمعی، سبک آزمون جامع)", "Section Checkpoint exam (cumulative, shelf-style)"],
  ["calibration", "کالیبراسیون خودکار دشواری + راهنمای پزشکی", "Adaptive difficulty calibration + medical guide"],
  // OFF by default: asking "did you guess?" on EVERY card cluttered the UI and
  // confused learners. Kept as an admin-toggleable opt-in feature.
  ["confidence_assess", "ارزیابی مبتنی بر اعتمادبه‌نفس (خودسنجی و گزارش کالیبراسیون)", "Confidence-based assessment (self-rating + calibration report)", 0],
  ["mastery", "نشان‌های تسلط بر مبحث (یادگیری تسلط‌محور + حافظهٔ پایدار)", "Topic mastery badges (mastery learning + durable memory)"],
  ["calm_mode", "حالت آرام (ضدِ فرسودگی: سقف مرور، روز استراحت، کاهش فشار)", "Calm Mode (anti-burnout: review cap, rest days, less pressure)"],
  ["anon_ranking", "حالت ناشناس در رتبه‌بندی (نمایش با نامِ مستعار)", "Anonymous ranking (appear under a pseudonym)"],
  ["full_bank", "بانک کامل سؤالات (جستجو و فیلتر) فقط برای پریمیوم", "Full question bank (search & filters) is premium-only"],
  ["summaries_free", "بانک خلاصهٔ فصل‌ها برای کاربران رایگان هم باز باشد", "Chapter-summary bank also open to free users", 0],
  // ---- Round 9 audit: every learner-facing feature gets its own switch ----
  ["bank_browse", "بانک سؤال (جست‌وجو و فیلتر)", "Question bank (browse & filters)"],
  ["custom_test", "آزمون‌سازِ شخصی 👑", "Custom test builder 👑"],
  ["summaries", "بانک خلاصهٔ فصل‌ها", "Chapter-summary bank"],
  ["crowd_insights", "سخت‌ترین سؤال‌ها (تحلیل جمعی)", "Crowd insights (hardest questions)"],
  ["ranking", "رتبه‌بندی کشوری/استانی", "Country / province ranking"],
  ["ramp_event", "چالش زمانی XP", "XP Ramp-Up event"],
  ["achievements", "دستاوردها", "Achievements"],
  ["quests", "کوئست‌های روزانه و صندوق‌ها", "Daily quests & chests"],
  ["notes", "یادداشت روی سؤال", "Per-question notes"],
  ["flagged_review", "مرورِ سؤال‌های نشان‌شده", "Flagged-question review"],
  ["library", "کتابخانه / ذخیره برای بعد", "Library / save for later"],
  ["legendary", "سطحِ افسانه‌ای", "Legendary level"],
  ["streak_wager", "شرط‌بندی استریک", "Streak wager"],
  ["monthly_quest", "کوئست ماهانه و نشان", "Monthly quest & badge"],
  ["streak_revival", "احیای استریک", "Streak revival"],
  ["mistakes_hub", "دفترِ اشتباه‌ها", "Mistakes hub"],
  ["progress", "پیشرفت من (آمار شخصی)", "My progress (personal analytics)"],
  ["option_stats", "شناسنامهٔ سؤال (درصد انتخاب هر گزینه)", "Question stats (option pick %)"],
  ["peer_percentile", "صدک و مقایسه با همتایان 👑", "Percentile vs peers 👑"],
  ["daily_report", "گزارش روزانهٔ عملکرد 👑", "Daily performance report 👑"],
  ["hint", "راهنمای استاد قبل از پاسخ 👑", "Pre-answer Attending hint 👑"],
  ["save_flashcard", "ذخیرهٔ یک‌ضربه‌ای به‌عنوان فلش‌کارت 👑", "One-tap save as flashcard 👑"],
  ["jump_ahead", "پرش از واحد", "Jump ahead (unit skip quiz)"],
  ["premium_trial", "هدیهٔ پرمیوم در نقاط عطف استریک", "Premium gift at streak milestones"],
];

export function ensureFlags() {
  for (const [key, fa, en, def] of DEFAULT_FLAGS) {
    const row = db.prepare("SELECT key FROM feature_flags WHERE key=?").get(key);
    // 4th tuple element is the default enabled state (defaults to 1/on)
    const enabled = def === 0 ? 0 : 1;
    if (!row) db.prepare("INSERT INTO feature_flags (key, enabled, label_fa, label_en) VALUES (?,?,?,?)").run(key, enabled, fa, en);
  }
  persistNow();
}

export function allFlags() {
  return db.prepare("SELECT * FROM feature_flags ORDER BY key").all();
}
export function isEnabled(key) {
  const row = db.prepare("SELECT enabled FROM feature_flags WHERE key=?").get(key);
  return row ? !!row.enabled : true; // default on if unknown
}
export function setFlag(key, enabled) {
  db.prepare("INSERT INTO feature_flags (key, enabled, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled, updated_at=datetime('now')")
    .run(key, enabled ? 1 : 0);
  persistNow();
}
