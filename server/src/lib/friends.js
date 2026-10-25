/* friends.js — Duolingo-style social layer for learners:
     • follow / unfollow (directed graph; a "friend" = mutual follow)
     • friend search
     • friend streak (pairwise: consecutive days BOTH did a lesson)
     • friend quest (weekly shared XP goal → gems + counts toward monthly badge)
     • activity feed with high-fives
     • nudges (reminder notification to a friend)
     • friends leaderboard (weekly XP among friends)
   Research: learners with a shared streak are 22% more likely to complete their
   daily lesson; adding friends makes learners 5.6x more likely to finish. */
import { db, persistNow } from "../db.js";
import { getProfile, tehranDay, isoWeekKey } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";
import { bumpMonthly } from "./duoplus.js";
import { notify } from "./notify.js";

function pair(a, b) { return a < b ? [a, b] : [b, a]; }
function daysBetween(x, y) { return Math.round((new Date(y + "T00:00:00Z") - new Date(x + "T00:00:00Z")) / 86400000); }
const nameOf = (u, lang) => (lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa)) || u.username;

/* ---------------- follow graph ---------------- */
export function follow(userId, targetId) {
  if (userId === targetId) return { ok: false, error: "self" };
  const t = db.prepare("SELECT id FROM users WHERE id=? AND role='learner' AND status='active'").get(targetId);
  if (!t) return { ok: false, error: "not found" };
  db.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)").run(userId, targetId);
  // if it's now mutual, seed a friend_streak row so it can start growing
  if (isMutual(userId, targetId)) ensureFriendStreak(userId, targetId);
  persistNow();
  return { ok: true };
}
export function unfollow(userId, targetId) {
  db.prepare("DELETE FROM follows WHERE follower_id=? AND followee_id=?").run(userId, targetId);
  persistNow();
  return { ok: true };
}
export function isFollowing(userId, targetId) {
  return !!db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?").get(userId, targetId);
}
export function isMutual(a, b) {
  return isFollowing(a, b) && isFollowing(b, a);
}
function ensureFriendStreak(a, b) {
  const [lo, hi] = pair(a, b);
  db.prepare("INSERT OR IGNORE INTO friend_streaks (user_lo, user_hi) VALUES (?,?)").run(lo, hi);
}

// people the user follows, with follow-back + friend-streak info
export function following(userId, lang = "fa") {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name_fa, u.name_en, u.avatar, lp.xp, lp.streak, lp.tier
    FROM follows f JOIN users u ON u.id = f.followee_id
    LEFT JOIN learner_profiles lp ON lp.user_id = u.id
    WHERE f.follower_id=? ORDER BY lp.xp DESC`).all(userId);
  return rows.map((u) => decorate(userId, u, lang));
}
export function followers(userId, lang = "fa") {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name_fa, u.name_en, u.avatar, lp.xp, lp.streak, lp.tier
    FROM follows f JOIN users u ON u.id = f.follower_id
    LEFT JOIN learner_profiles lp ON lp.user_id = u.id
    WHERE f.followee_id=? ORDER BY lp.xp DESC`).all(userId);
  return rows.map((u) => decorate(userId, u, lang));
}
function decorate(meId, u, lang) {
  const mutual = isMutual(meId, u.id);
  let fs = null;
  if (mutual) {
    const [lo, hi] = pair(meId, u.id);
    const row = db.prepare("SELECT streak FROM friend_streaks WHERE user_lo=? AND user_hi=?").get(lo, hi);
    fs = row?.streak || 0;
  }
  return {
    id: u.id, name: nameOf(u, lang), avatar: u.avatar || "",
    xp: u.xp || 0, streak: u.streak || 0, tier: u.tier || "bronze",
    following: isFollowing(meId, u.id), followsMe: isFollowing(u.id, meId),
    friend: mutual, friendStreak: fs,
  };
}

export function searchLearners(userId, q, lang = "fa", limit = 20) {
  const like = `%${(q || "").trim()}%`;
  if (!q || !q.trim()) return [];
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name_fa, u.name_en, u.avatar, lp.xp, lp.streak, lp.tier
    FROM users u LEFT JOIN learner_profiles lp ON lp.user_id = u.id
    WHERE u.role='learner' AND u.status='active' AND u.id<>?
      AND (u.name_fa LIKE ? OR u.name_en LIKE ? OR u.username LIKE ?)
    ORDER BY lp.xp DESC LIMIT ?`).all(userId, like, like, like, limit);
  return rows.map((u) => decorate(userId, u, lang));
}

/* ---------------- friend streak (called after every lesson finish) ---------------- */
// Mark today active for `userId` across all mutual friendships; advance the
// shared streak only when BOTH parties have been active today.
export function markFriendActivity(userId) {
  const today = tehranDay();
  const friends = db.prepare(`
    SELECT f1.followee_id AS fid FROM follows f1
    JOIN follows f2 ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id
    WHERE f1.follower_id=?`).all(userId).map((r) => r.fid);
  for (const fid of friends) {
    ensureFriendStreak(userId, fid);
    const [lo, hi] = pair(userId, fid);
    const row = db.prepare("SELECT * FROM friend_streaks WHERE user_lo=? AND user_hi=?").get(lo, hi);
    const isLo = userId === lo;
    const myCol = isLo ? "lo_day" : "hi_day";
    const otherDay = isLo ? row.hi_day : row.lo_day;
    // record my activity today
    db.prepare(`UPDATE friend_streaks SET ${myCol}=? WHERE id=?`).run(today, row.id);
    // if both active today and we haven't advanced today yet, advance the streak
    if (otherDay === today && row.last_day !== today) {
      // continuity: only +1 if the previous shared day was yesterday, else reset to 1
      const cont = row.last_day && daysBetween(row.last_day, today) === 1;
      const next = cont ? row.streak + 1 : 1;
      const best = Math.max(row.best, next);
      db.prepare("UPDATE friend_streaks SET streak=?, best=?, last_day=? WHERE id=?").run(next, best, today, row.id);
    }
  }
  persistNow();
}

export function friendStreaks(userId, lang = "fa") {
  const cfg = getGameConfig().friends;
  const rows = db.prepare(`
    SELECT fs.*, 
      CASE WHEN fs.user_lo=? THEN fs.user_hi ELSE fs.user_lo END AS other_id
    FROM friend_streaks fs
    WHERE (fs.user_lo=? OR fs.user_hi=?) AND fs.streak>0
    ORDER BY fs.streak DESC`).all(userId, userId, userId);
  const today = tehranDay();
  const out = rows.map((r) => {
    const u = db.prepare("SELECT id, username, name_fa, name_en, avatar FROM users WHERE id=?").get(r.other_id);
    const isLo = userId === r.user_lo;
    const myDay = isLo ? r.lo_day : r.hi_day;
    const otherDay = isLo ? r.hi_day : r.lo_day;
    return {
      friendId: r.other_id, name: nameOf(u, lang), avatar: u?.avatar || "",
      streak: r.streak, best: r.best,
      meDoneToday: myDay === today, friendDoneToday: otherDay === today,
      // can nudge if I'm done today but my friend isn't yet
      canNudge: myDay === today && otherDay !== today,
    };
  });
  return { streaks: out, max: cfg.max_streaks };
}

export function nudge(userId, friendId, lang = "fa") {
  if (!isMutual(userId, friendId)) return { ok: false, error: "not friends" };
  const me = db.prepare("SELECT name_fa, name_en, username FROM users WHERE id=?").get(userId);
  const nm = nameOf(me, lang);
  notify(friendId, {
    kind: "friend", icon: "flame", link: "friends",
    title_fa: `👋 ${nm} تلنگر زد`, title_en: `👋 ${nm} nudged you`,
    body_fa: "استریک دوستانه‌تان امروز در خطر است — یک درس کوتاه انجام بده!",
    body_en: "Your friend streak is at risk today — do a quick lesson!",
  });
  persistNow();
  return { ok: true };
}

/* ---------------- friend quest (weekly shared XP goal) ---------------- */
export function startFriendQuest(userId, friendId) {
  if (!isMutual(userId, friendId)) return { ok: false, error: "not friends" };
  const cfg = getGameConfig().friends;
  const wk = isoWeekKey();
  // one active quest per pair per week (either direction)
  const existing = db.prepare(`
    SELECT * FROM friend_quests WHERE week_key=? AND status<>'claimed'
      AND ((a_id=? AND b_id=?) OR (a_id=? AND b_id=?))`).get(wk, userId, friendId, friendId, userId);
  if (existing) return { ok: false, error: "already active" };
  db.prepare(`INSERT INTO friend_quests (week_key, a_id, b_id, goal, reward_gems) VALUES (?,?,?,?,?)`)
    .run(wk, userId, friendId, cfg.quest_goal, cfg.quest_reward);
  const me = db.prepare("SELECT name_fa, name_en, username FROM users WHERE id=?").get(userId);
  notify(friendId, {
    kind: "friend", icon: "trophy", link: "friends",
    title_fa: `🤝 ${nameOf(me, "fa")} چالش دوستانه شروع کرد`,
    title_en: `🤝 ${nameOf(me, "en")} started a Friend Quest`,
    body_fa: `با هم ${cfg.quest_goal} XP جمع کنید و جایزه بگیرید!`,
    body_en: `Earn ${cfg.quest_goal} XP together to win a reward!`,
  });
  persistNow();
  return { ok: true };
}

// Advance the current friend quest(s) for this user by `xp` (called on lesson finish).
export function progressFriendQuests(userId, xp) {
  const wk = isoWeekKey();
  const rows = db.prepare(`SELECT * FROM friend_quests WHERE week_key=? AND status='active' AND (a_id=? OR b_id=?)`).all(wk, userId, userId);
  for (const q of rows) {
    const col = q.a_id === userId ? "a_xp" : "b_xp";
    db.prepare(`UPDATE friend_quests SET ${col}=${col}+? WHERE id=?`).run(xp, q.id);
    const updated = db.prepare("SELECT * FROM friend_quests WHERE id=?").get(q.id);
    if (updated.a_xp + updated.b_xp >= updated.goal && updated.status === "active") {
      db.prepare("UPDATE friend_quests SET status='complete' WHERE id=?").run(q.id);
      for (const uid of [updated.a_id, updated.b_id]) {
        notify(uid, {
          kind: "friend", icon: "trophy", link: "friends",
          title_fa: "🎉 چالش دوستانه کامل شد!", title_en: "🎉 Friend Quest complete!",
          body_fa: `جایزه‌ات را دریافت کن: +${updated.reward_gems} جم`,
          body_en: `Claim your reward: +${updated.reward_gems} gems`,
        });
      }
    }
  }
  persistNow();
}

export function friendQuests(userId, lang = "fa") {
  const wk = isoWeekKey();
  const rows = db.prepare(`SELECT * FROM friend_quests WHERE week_key=? AND (a_id=? OR b_id=?) ORDER BY id DESC`).all(wk, userId, userId);
  return rows.map((q) => {
    const otherId = q.a_id === userId ? q.b_id : q.a_id;
    const u = db.prepare("SELECT id, username, name_fa, name_en, avatar FROM users WHERE id=?").get(otherId);
    const mine = q.a_id === userId ? q.a_xp : q.b_xp;
    const theirs = q.a_id === userId ? q.b_xp : q.a_xp;
    const claimed = q.a_id === userId ? q.a_claimed : q.b_claimed;
    return {
      id: q.id, partner: nameOf(u, lang), partnerId: otherId, avatar: u?.avatar || "",
      goal: q.goal, myXp: mine, partnerXp: theirs, total: q.a_xp + q.b_xp,
      reward_gems: q.reward_gems, status: q.status,
      complete: (q.a_xp + q.b_xp) >= q.goal, claimed: !!claimed,
    };
  });
}

export function claimFriendQuest(userId, questId) {
  const q = db.prepare("SELECT * FROM friend_quests WHERE id=? AND (a_id=? OR b_id=?)").get(questId, userId, userId);
  if (!q) return { ok: false, error: "not found" };
  if ((q.a_xp + q.b_xp) < q.goal) return { ok: false, error: "not complete" };
  const isA = q.a_id === userId;
  if ((isA && q.a_claimed) || (!isA && q.b_claimed)) return { ok: false, error: "claimed" };
  db.prepare(`UPDATE friend_quests SET ${isA ? "a_claimed" : "b_claimed"}=1 WHERE id=?`).run(q.id);
  db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(q.reward_gems, userId);
  // a completed friend quest counts toward the monthly badge (like Duolingo)
  bumpMonthly(userId);
  // if both claimed, mark the quest fully claimed
  const after = db.prepare("SELECT a_claimed, b_claimed FROM friend_quests WHERE id=?").get(q.id);
  if (after.a_claimed && after.b_claimed) db.prepare("UPDATE friend_quests SET status='claimed' WHERE id=?").run(q.id);
  persistNow();
  return { ok: true, gems: q.reward_gems, profile: getProfile(userId) };
}

/* ---------------- activity feed + high-fives ---------------- */
export function postFeed(userId, kind, title_fa, title_en, icon = "medal") {
  const day = tehranDay();
  // de-dupe the same kind on the same day
  const dup = db.prepare("SELECT 1 FROM feed_events WHERE user_id=? AND kind=? AND day=?").get(userId, kind, day);
  if (dup) return;
  db.prepare("INSERT INTO feed_events (user_id, kind, title_fa, title_en, icon, day) VALUES (?,?,?,?,?,?)")
    .run(userId, kind, title_fa, title_en, icon, day);
  persistNow();
}

// The feed a user sees = their own events + events of people they follow.
export function getFeed(userId, lang = "fa", limit = 40) {
  const rows = db.prepare(`
    SELECT e.*, u.name_fa, u.name_en, u.username, u.avatar,
      (SELECT COUNT(*) FROM feed_highfives h WHERE h.event_id=e.id) AS highfives,
      (SELECT COUNT(*) FROM feed_highfives h WHERE h.event_id=e.id AND h.user_id=?) AS mine
    FROM feed_events e JOIN users u ON u.id = e.user_id
    WHERE e.user_id=? OR e.user_id IN (SELECT followee_id FROM follows WHERE follower_id=?)
    ORDER BY e.id DESC LIMIT ?`).all(userId, userId, userId, limit);
  return rows.map((e) => ({
    id: e.id, userId: e.user_id, isMe: e.user_id === userId,
    name: nameOf(e, lang), avatar: e.avatar || "",
    title: lang === "fa" ? e.title_fa : e.title_en, icon: e.icon || "medal",
    highfives: e.highfives, hifived: !!e.mine, day: e.day,
  }));
}

export function highFive(userId, eventId, lang = "fa") {
  const ev = db.prepare("SELECT * FROM feed_events WHERE id=?").get(eventId);
  if (!ev) return { ok: false, error: "not found" };
  if (ev.user_id === userId) return { ok: false, error: "self" };
  db.prepare("INSERT OR IGNORE INTO feed_highfives (event_id, user_id) VALUES (?,?)").run(eventId, userId);
  const me = db.prepare("SELECT name_fa, name_en, username FROM users WHERE id=?").get(userId);
  notify(ev.user_id, {
    kind: "friend", icon: "star", link: "friends",
    title_fa: `🙌 ${nameOf(me, "fa")} به تو های‌فایو داد`,
    title_en: `🙌 ${nameOf(me, "en")} high-fived you`,
    body_fa: lang === "fa" ? ev.title_fa : ev.title_en, body_en: ev.title_en,
  });
  persistNow();
  return { ok: true };
}

/* ---------------- friends leaderboard (weekly XP among friends) ---------------- */
export function friendsLeaderboard(userId, lang = "fa") {
  const ids = db.prepare(`
    SELECT f1.followee_id AS fid FROM follows f1
    JOIN follows f2 ON f2.follower_id=f1.followee_id AND f2.followee_id=f1.follower_id
    WHERE f1.follower_id=?`).all(userId).map((r) => r.fid);
  ids.push(userId);
  const rows = db.prepare(`
    SELECT u.id, u.name_fa, u.name_en, u.username, u.avatar, lp.weekly_xp, lp.streak, lp.tier
    FROM users u JOIN learner_profiles lp ON lp.user_id=u.id
    WHERE u.id IN (${ids.map(() => "?").join(",")})
    ORDER BY lp.weekly_xp DESC, u.id ASC`).all(...ids);
  return rows.map((u, i) => ({
    rank: i + 1, id: u.id, isMe: u.id === userId, name: nameOf(u, lang), avatar: u.avatar || "",
    weeklyXp: u.weekly_xp || 0, streak: u.streak || 0, tier: u.tier || "bronze",
  }));
}
