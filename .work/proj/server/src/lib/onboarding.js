/* onboarding.js — "Getting started" activation checklist for new learners.
   Research: short (3–5 item) checklists that teach BY DOING drive activation and
   week-1 retention far more than passive tours. Steps are derived from the
   learner's REAL data (first lesson, daily goal, first review, explored a tool),
   so ticking a box always reflects a genuine action toward value. Admin controls
   which steps show + the completion reward via gameconfig. */
import { db, persistNow } from "../db.js";
import { getProfile } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";

// static labels for each step (both languages) + which nav tab it points to
const STEP_DEFS = [
  { key: "first_lesson", icon: "play", link: "path",
    fa: "اولین درس را کامل کن", en: "Complete your first lesson",
    hintFa: "از «مسیر یادگیری» شروع کن.", hintEn: "Start from the Learning Path." },
  { key: "set_goal", icon: "target", link: "quests",
    fa: "هدف روزانه‌ات را انتخاب کن", en: "Set your daily goal",
    hintFa: "در «ماموریت‌ها» یک هدف واقع‌بینانه انتخاب کن.", hintEn: "Pick a realistic goal in Quests." },
  { key: "first_review", icon: "repeat", link: "review",
    fa: "اولین مرور را انجام بده", en: "Do your first review",
    hintFa: "کارت‌های سررسیدشده را در «مرور» تمرین کن.", hintEn: "Practice due cards in Review." },
  { key: "explore", icon: "bolt", link: "practice",
    fa: "یک ابزار هوشمند را امتحان کن", en: "Try a smart tool",
    hintFa: "«تمرین هوشمند» یا «دوستان» را کشف کن.", hintEn: "Explore Smart Practice or Friends." },
];

// mark that the learner has chosen a daily goal (called from the goal endpoint)
export function markGoalSet(userId) {
  db.prepare("UPDATE learner_profiles SET goal_set=1 WHERE user_id=?").run(userId);
  persistNow();
}

function isDone(userId, key) {
  const p = getProfile(userId);
  switch (key) {
    case "first_lesson":
      return db.prepare("SELECT 1 FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL LIMIT 1").get(userId) ? true : false;
    case "set_goal":
      return !!p.goal_set;
    case "first_review":
      return db.prepare("SELECT 1 FROM srs_state WHERE user_id=? AND reps>=1 LIMIT 1").get(userId) ? true : false;
    case "explore":
      // any XP earned from a smart-practice/event session, OR they follow someone
      return (db.prepare("SELECT 1 FROM xp_events WHERE user_id=? AND reason IN ('practice','event','legendary') LIMIT 1").get(userId)
        || db.prepare("SELECT 1 FROM follows WHERE follower_id=? LIMIT 1").get(userId)) ? true : false;
    default: return false;
  }
}

export function onboardingStatus(userId, lang = "fa") {
  const cfg = getGameConfig().onboarding;
  const p = getProfile(userId);
  const enabledSteps = STEP_DEFS.filter((s) => cfg.steps?.[s.key] !== false);
  const steps = enabledSteps.map((s) => ({
    key: s.key, icon: s.icon, link: s.link,
    label: lang === "fa" ? s.fa : s.en,
    hint: lang === "fa" ? s.hintFa : s.hintEn,
    done: isDone(userId, s.key),
  }));
  const doneCount = steps.filter((s) => s.done).length;
  const complete = steps.length > 0 && doneCount === steps.length;
  return {
    enabled: cfg.enabled,
    dismissed: !!p.onboarding_dismissed,
    claimed: !!p.onboarding_claimed,
    reward_gems: cfg.reward_gems,
    steps, doneCount, total: steps.length, complete,
    // show the widget until it's completed+claimed OR explicitly dismissed
    show: cfg.enabled && !p.onboarding_dismissed && !(complete && p.onboarding_claimed),
  };
}

export function dismissOnboarding(userId) {
  db.prepare("UPDATE learner_profiles SET onboarding_dismissed=1 WHERE user_id=?").run(userId);
  persistNow();
}

// claim the completion reward (once). Returns updated profile.
export function claimOnboarding(userId) {
  const st = onboardingStatus(userId);
  const p = getProfile(userId);
  if (!st.complete) return { ok: false, error: "incomplete" };
  if (p.onboarding_claimed) return { ok: false, error: "claimed" };
  db.prepare("UPDATE learner_profiles SET onboarding_claimed=1, gems=gems+? WHERE user_id=?").run(st.reward_gems, userId);
  persistNow();
  return { ok: true, gems: st.reward_gems, profile: getProfile(userId) };
}
