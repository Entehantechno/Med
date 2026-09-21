/* gameconfig.js — Admin-tunable configuration for the new Duolingo-2026
   gamification & ad mechanics. Every knob here is editable from the admin panel
   (Admin → گیمیفیکیشن). Values are stored as a single JSON row in `settings`
   under the key `gameplus_config`; missing keys fall back to DEFAULT_GAME_CONFIG
   so old databases keep working. */
import { db, persistNow } from "../db.js";

export const GAME_CONFIG_KEY = "gameplus_config";

export const DEFAULT_GAME_CONFIG = {
  // --- Hearts (lives) for non-premium learners ---
  hearts: {
    max: 30,               // full bar
    refill_minutes: 30,    // one heart regenerates every N minutes
    refill_gems: 50,       // gem cost of an instant full refill
  },
  // --- Streak Wager (spend gems, commit to N days, double back) ---
  wager: {
    enabled: true,
    target_days: 7,        // how many more streak days to reach
    stake: 50,             // gems staked
    reward: 100,           // gems paid out on success (2× by default)
  },
  // --- Monthly Quest → collectible badge ---
  monthly: {
    enabled: true,
    goal: 25,              // daily quests to complete this month
    reward_gems: 200,      // gems on top of the collectible badge
  },
  // --- XP Ramp-Up timed challenge event ---
  event: {
    enabled: true,
    slug: "ramp-xp",
    title_fa: "چالش زمانی XP",
    title_en: "XP Ramp-Up Challenge",
    questions: 12,         // questions in one run
    duration_s: 150,       // 2.5-minute window
    xp_per_correct: 10,    // bonus XP per correct answer
    bonus_all_correct: 40, // extra XP for a flawless run
  },
  // --- Streak Revival (free comeback for lapsed high-streak users) ---
  revival: {
    enabled: true,
    min_streak: 7,         // only offer revival if the lost streak was >= this
    lessons_required: 3,   // complete this many lessons to restore
  },
  // --- Rewarded ads (Duolingo Ads model): reward for opting-in to watch ---
  ads: {
    rewarded_gems: 15,     // gems granted per rewarded-video view
    daily_reward_cap: 5,   // max rewarded views that pay out per day
    prelesson_gems: 10,    // gems for the pre-lesson sponsorship view
  },
  // --- Placement test (entry quiz that recommends a starting point) ---
  placement: {
    enabled: true,
    // HOW the test is offered to a new learner (admin-controlled):
    //   "optional" = a friendly, dismissible offer card on the home (default)
    //   "prompt"   = shown once on first visit, clearly skippable
    //   "off"      = never offered (same effect as enabled:false)
    mode: "optional",
    questions: 12,         // how many questions in the quiz
    strong_accuracy: 70,   // per-topic accuracy above which a topic is "strong"
    // What happens on a STRONG topic:
    //   "unlock"    = unlock that topic's lessons without faking progress (default, honest)
    //   "mark_done" = auto-complete the first lesson (Duolingo-style real skip)
    //   "off"       = do nothing (test is purely informational)
    skip_behavior: "unlock",
    skip_ahead: true,      // (legacy) kept for backward-compat; skip_behavior wins
    dismissible: true,     // learner can hide the offer without taking it
    allow_retake: true,    // learner may retake the placement later
    // --- Adaptive mode (سختی سوال بر اساس پاسخ‌های قبلی) ---
    //   OFF → classic fixed quiz (a balanced set built up-front).
    //   ON  → questions are served one-at-a-time; the next question gets HARDER
    //         after a correct answer and EASIER after a wrong one, so we home in
    //         on the learner's true level with fewer questions.
    adaptive: false,
    adaptive_start: "medium", // difficulty of the first adaptive question: easy|medium|hard
    // Editable offer/intro copy (blank → falls back to the built-in i18n text)
    offer_fa: "", offer_en: "",
    intro_fa: "", intro_en: "",
  },
  // --- Round 9: peer-benchmark & premium extras (UWorld/AMBOSS/Duolingo-informed) ---
  peer: {
    option_stats: true,        // «شناسنامهٔ سؤال»: % of learners picking each option + avg time (free)
    option_stats_min: 5,       // min answers before percentages are shown (avoid 1-sample noise)
    percentile: true,          // percentile + time-vs-peers on exam-sim / custom-test result (premium)
    percentile_min: 5,         // min finished tests by others before a percentile is shown
    daily_report: true,        // «گزارش روزانهٔ عملکرد» card on home (premium)
    hint: true,                // pre-answer Attending hint (premium; costs gems for free users)
    hint_gems: 5,              // gem cost of a hint for non-premium learners (0 = free)
    save_flashcard: true,      // one-tap «ذخیره به‌عنوان فلش‌کارت» from the explanation (premium)
    trial_days: 3,             // free premium days granted at streak milestones (0 = off)
    trial_milestones: [100, 200, 365], // streak days that grant the premium taste
    jump_ahead: true,          // «پرش از واحد»: short quiz unlocks the rest of a unit
    jump_questions: 8,         // quiz size
    jump_pass: 80,             // % correct required
    jump_premium_only: false,  // false → free learners may also jump (still must pass)
  },
  // --- Onboarding checklist (getting-started activation flow) ---
  onboarding: {
    enabled: true,
    reward_gems: 50,       // gems granted when the whole checklist is completed
    // which steps to show (admins can hide steps that don't fit their rollout)
    steps: { first_lesson: true, set_goal: true, first_review: true, explore: true },
  },
  // --- Friend Quest (weekly shared XP goal between two friends) ---
  friends: {
    quest_goal: 300,       // shared weekly XP goal
    quest_reward: 100,     // gems each partner gets on completion
    max_streaks: 5,        // max simultaneous friend streaks (Duolingo caps at 5)
  },
  // --- Legendary levels (crown 6): master a lesson, then beat a harder run ---
  legendary: {
    enabled: true,
    cost_gems: 100,        // gem cost to attempt (free for premium learners)
    pass_ratio: 90,        // % correct required to earn the legendary crown
    xp_reward: 40,         // bonus XP on success (Duolingo ~40 XP)
  },
  // --- Diamond Tournament (elite bracket for Diamond-tier learners) ---
  tournament: {
    enabled: true,
    advance: 10,           // top N advance to the next stage / win the finals
    podium_gems: [200, 120, 80], // gems for finals ranks 1,2,3
    boost_minutes: 30,     // XP-boost minutes for all finalists
  },
  // --- Spaced-repetition scheduler (FSRS-6 DSR model, or legacy SM-2) ---
  srs: {
    scheduler: "fsrs",        // "fsrs" (modern, default) | "sm2" (legacy)
    desired_retention: 0.9,   // target recall probability (0.80–0.97 sweet spot)
    maximum_interval: 365,    // cap the next-review interval (days)
    learning_steps: [1, 10],  // minutes for the first learning steps
    relearning_steps: [10],   // minutes after a lapse
    // --- Cumulative interleaving (medical, not language) ---
    // When a learner opens a lesson, mix in a few DUE review cards from
    // previously-studied topics in the SAME program. This is evidence-based
    // "cumulative review" for medicine: it forces discrimination between
    // similar diseases/mechanisms and fights the forgetting curve. Set
    // interleave_max = 0 to disable.
    interleave_max: 2,        // max review cards blended into a lesson
    interleave_same_topic: true, // never drop a nephrology card into a neurology lesson
    interleave_position: "spread", // "spread" (interspersed) | "end" (after new)
    // FSRS-6 default parameters (21 weights). Admins can retune, but defaults
    // are the population-average values shipped with Anki 24.x.
    params: [
      0.2172, 1.1771, 3.2602, 16.1507, 7.0114, 0.57, 2.0966, 0.0069, 1.5261,
      0.112, 1.0178, 1.849, 0.1133, 0.3127, 2.2934, 0.2191, 3.0004, 0.7536,
      0.3332, 0.1437, 0.2,
    ],
  },
  // --- Section Checkpoint exam (shelf-exam style, cumulative) ---
  // A comprehensive test unlocked once a learner finishes enough lessons in a
  // whole SECTION (the topic parent group, e.g. all Internal-Medicine topics).
  // It MIXES questions drawn from across the section so the learner must
  // discriminate between similar diseases/mechanisms under one blueprint —
  // exactly like an NBME subject ("shelf") exam. Evidence-based: cumulative
  // testing lifts long-term retention (the "testing effect"). AI-free.
  checkpoint: {
    enabled: true,
    unlock_ratio: 0.6,     // fraction of a section's lessons that must be done to unlock
    min_nodes: 3,          // AND at least this many completed lessons in the section
    question_count: 12,    // questions per checkpoint (shelf-style mixed blueprint)
    pass_ratio: 0.7,       // score needed to PASS (0..1) — NBME-style ~70%
    per_topic_cap: 3,      // max questions pulled from any single topic (forces spread)
    time_per_q: 60,        // seconds/question budget shown (0 = untimed)
    xp_reward: 120,        // XP for passing (scaled by score); shelf exams are worth more
    xp_retry: 30,          // consolation XP for a failed attempt (still retrieval practice)
    cooldown_hours: 0,     // hours to wait between attempts (0 = retry immediately)
  },
  // --- Topic Mastery Badges (Bloom's Mastery Learning + durable memory) ------
  // A learner earns a "mastery" badge on a TOPIC only when they show BOTH:
  //   (1) high accuracy on that topic's cards (Bloom's classic ≥90% criterion),
  //       measured over at least `min_answers` answered cards (so one lucky quiz
  //       can't grant it), AND
  //   (2) DURABLE memory — a share of the topic's cards are SRS-"mature"
  //       (stability ≥ `mature_days`), proving the knowledge survives over time,
  //       not just a fresh cram. This is real Mastery Learning, not a sticker.
  // Fully deterministic & AI-free. Every threshold is admin-tunable, and the
  // whole feature can be turned off via the `mastery` feature flag.
  mastery: {
    enabled: true,
    accuracy: 90,          // % accuracy required on the topic's cards (Bloom ≥90%)
    min_answers: 12,       // minimum answered cards before mastery can be granted
    require_retention: true, // also require durable (SRS-mature) memory
    mature_days: 21,       // SRS stability (days) at/above which a card is "mature"
    mature_ratio: 0.6,     // fraction of the topic's seen cards that must be mature
    reward_gems: 60,       // gems granted once, the first time a topic is mastered
    reward_xp: 50,         // XP granted once, the first time a topic is mastered
  },
  // --- Anonymous / Stealth ranking (opt-in privacy for leaderboards) ---------
  // Research (Bai 2021; Balci 2022): bottom-ranked learners prefer anonymity to
  // "save face", and pseudonyms minimise the negative, anxiety-inducing effects
  // of leaderboards while KEEPING the motivational benefit of competing. A
  // learner can opt in to appear under a pseudonym to everyone else, while still
  // seeing their own real rank/name. Deterministic & AI-free; admin sets the
  // alias pool and can disable the feature.
  anon: {
    enabled: true,
    // neutral, non-identifying medical aliases assigned when a learner turns on
    // stealth mode without choosing their own nickname.
    alias_pool_fa: ["پزشکِ ناشناس", "دانشجوی مصمم", "رزیدنتِ آینده", "شفاگرِ کوشا", "ذهنِ کنجکاو", "قهرمانِ خاموش"],
    alias_pool_en: ["Anonymous Medic", "Determined Student", "Future Resident", "Diligent Healer", "Curious Mind", "Silent Champion"],
  },
  // --- Calm Mode (anti-burnout, opt-in) --------------------------------------
  // Medical-student burnout is highly prevalent (27–75%) and streak/competition
  // pressure + an ever-growing review pile are well-documented drivers (see the
  // research doc). Calm Mode lets a learner OPT IN to humane guardrails:
  //   • a daily review CAP so the spaced-repetition queue never overwhelms,
  //   • planned REST DAYS that preserve the streak (no guilt for a day off),
  //   • hide the streak flame + opt out of leagues to remove pressure,
  //   • gentle break/wellbeing reminders instead of urgency.
  // All deterministic & AI-free. Admin tunes the defaults & can disable it.
  calm: {
    enabled: true,
    default_review_cap: 40,   // default max due-review cards/day when Calm Mode is on
    min_review_cap: 10,       // the smallest cap a learner may choose ("do 10 min")
    max_review_cap: 100,      // the largest cap a learner may choose
    rest_days_per_week: 2,    // planned days off that keep the streak alive
    show_wellbeing_tips: true, // show a supportive break/breathing message
  },
  // --- Automatic difficulty calibration (Challenge Point Framework) ---
  // Keeps each learner in their "optimal challenge zone": lessons are reordered
  // so questions are effortful but usually succeed (~78% target). Evidence-based
  // (Guadagnoli, Morin & Dubrowski, Med Educ 2012). AI-free — uses only the
  // telemetry we already collect (accuracy + response time). Set enabled=false
  // to serve lessons in their default (random) order.
  calibration: {
    enabled: true,
    target_success: 0.78,   // centre of the challenge zone (0.5–0.95)
    zone_width: 0.12,       // half-width of the "in zone" band around the target
    window_answers: 40,     // how many recent answers estimate current ability
    min_answers: 8,         // below this we don't calibrate yet (not enough signal)
    slow_ms: 12000,         // a correct answer slower than this counts as low-confidence
    ease_in: true,          // start a lesson slightly easier, then ramp into the zone
  },
  // --- Smart Practice Hub (UWorld-style targeted weak-area sessions) ---
  practice: {
    enabled: true,
    session_size: 10,      // questions per targeted session
    min_answers: 3,        // min attempts before a topic counts as "weak"
    weak_accuracy: 70,     // topics below this accuracy are "weak"
    xp_per_correct: 3,     // small XP per correct answer in a practice session
    // relative weights of each source when mixing a session
    mix: { weak: 4, mistakes: 3, due: 2, hardest: 1 },
  },
  // --- Landing page social proof ("by the numbers" bar) ---
  landing: {
    // Display floor: the marketing stat bar never shows a number lower than this.
    // Once the REAL value passes the floor, the real (rounded) value is shown.
    // This keeps a fresh install from looking empty without ever hiding growth.
    stats_floor: {
      learners: 0,     // e.g. 12000 to show "12,000+" until you really have more
      questions: 0,    // e.g. 3500
      topics: 0,       // e.g. 27
      xp: 0,           // e.g. 2000000
      accuracy: 0,     // e.g. 92 (shown only when there are no real attempts yet)
    },
  },
  // --- Referral (invite-a-friend) program — double-sided rewards, admin-tunable ---
  referral: {
    enabled: true,
    referrer_gems: 100,        // gems the inviter gets per qualified friend
    referrer_xp: 0,            // optional XP for the inviter
    referred_gems: 50,         // gems the new friend gets
    referred_premium_days: 0,  // optional free premium days for the new friend
    qualify_on: "signup",      // "signup" (instant) | "first_lesson" (must do a lesson)
    // milestone rewards: invite N friends → bonus. Admin-editable list.
    milestones: [
      { count: 3, gems: 200, premium_days: 7, label_fa: "۳ دوست", label_en: "3 friends" },
      { count: 10, gems: 500, premium_days: 30, label_fa: "۱۰ دوست", label_en: "10 friends" },
    ],
  },
  // --- Social sharing (Instagram story cards + share-to-earn) ---
  social: {
    enabled: true,
    reward_gems: 15,           // gems for sharing (once per day per kind)
    daily_reward_cap: 2,       // max rewarded shares per day
    brand_tag: "@medschool",   // shown on story cards + share text
    site_url: "medschool.ir",  // shown on story cards + share text
  },
  // --- Daily Diagnosis Challenge (Wordle-style clinical reasoning game) ---
  dx: {
    enabled: true,
    max_guesses: 6,            // default guesses per case (a case can override)
    xp_solved: 40,             // XP for solving the daily case
    xp_first_try_bonus: 30,    // extra XP if solved on the first guess
    gems_solved: 10,           // gems for solving
    counts_for_streak: true,   // solving the daily case keeps the learning streak alive
  },
  // --- Smart reminders (behavior-based, not fixed-clock; research: Duolingo) ---
  reminders: {
    enabled: true,
    daily_cap: 2,              // max reminders per learner per day (avoid fatigue)
    goal_reminder: true,       // remind if today's daily-goal isn't met yet
    streak_save: true,         // "save" reminder when a streak is about to break
    winback_days: 7,           // send win-back reminders up to N days after last active
    winback_after: 1,          // start win-back this many days after last active
    // when true, only remind a learner around their revealed "habit window"
    // (the Tehran hour they were most active) instead of any time.
    respect_habit_window: true,
  },
  // --- PWA / installable mobile app (add-to-home-screen) ---
  pwa: {
    enabled: true,             // master switch for the install experience
    show_prompt: true,         // show the custom "install app" card automatically
    snooze_days: 14,           // days to wait before re-offering after "Later"
    ios_hint: true,            // show iOS Safari "Add to Home Screen" instructions
    offline_enabled: true,     // service-worker offline shell + caching on
  },
  // --- Certificates (course/program completion, verifiable) ---
  certificates: {
    enabled: true,
    org_name_fa: "MED School",
    org_name_en: "MED School",
    signer_name_fa: "مدیر آموزش",
    signer_name_en: "Head of Education",
    signer_title_fa: "MED School",
    signer_title_en: "MED School",
    program_threshold: 100,     // % of path nodes done to earn a program certificate
    course_threshold: 100,      // % of course lessons watched to earn a course cert
    auto_issue: true,           // auto-issue when the learner crosses the threshold
    show_hours: true,           // print "N hours of study" on the certificate
  },
  // --- Security hardening (Helmet + rate limiting), production-safe defaults ---
  security: {
    enabled: true,             // master switch for rate limiting (headers always on)
    api_window_min: 15,        // general API rate-limit window (minutes)
    api_max: 300,              // max API requests per window per IP
    auth_window_min: 15,       // login/register rate-limit window (minutes)
    auth_max: 8,               // max auth attempts per window per IP (brute-force guard)
  },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && typeof base?.[k] === "object") {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

export function getGameConfig() {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(GAME_CONFIG_KEY);
  if (!row) return DEFAULT_GAME_CONFIG;
  try { return deepMerge(DEFAULT_GAME_CONFIG, JSON.parse(row.value)); }
  catch { return DEFAULT_GAME_CONFIG; }
}

export function saveGameConfig(cfg) {
  const merged = deepMerge(DEFAULT_GAME_CONFIG, cfg || {});
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(GAME_CONFIG_KEY, JSON.stringify(merged));
  persistNow();
  return merged;
}
