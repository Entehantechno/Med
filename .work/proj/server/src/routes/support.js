/* support.js (routes) — user-facing in-app support chat.
   Any authenticated user (learner / student / teacher) can open a ticket and
   chat with the admin team. Admin-side management lives in routes/admin.js. */
import { Router } from "express";
import { authRequired } from "../lib/auth.js";
import { isEnabled } from "../lib/flags.js";
import { CATEGORIES, myThread, userReply, markUserRead, userUnreadCount } from "../lib/support.js";
import { HELP_CATEGORIES, publicArticles, viewArticle } from "../lib/helpcenter.js";

const r = Router();
const L = (req) => (req.query.lang === "en" ? "en" : "fa");
const gate = (req, res, next) => (isEnabled("support") ? next() : res.status(403).json({ error: "feature disabled", flag: "support" }));
const helpGate = (req, res, next) => (isEnabled("help_center") ? next() : res.status(403).json({ error: "feature disabled", flag: "help_center" }));

/* ---- Help center / FAQ (self-serve; any authenticated user) ---- */
r.get("/help", authRequired, helpGate, (req, res) => {
  res.json({
    articles: publicArticles(L(req), { q: req.query.q || "", category: req.query.category || "" }),
    categories: HELP_CATEGORIES,
    enabled: true,
  });
});
r.get("/help/enabled", authRequired, (req, res) => res.json({ enabled: isEnabled("help_center") }));
r.get("/help/:id", authRequired, helpGate, (req, res) => {
  const a = viewArticle(parseInt(req.params.id, 10), L(req));
  if (!a) return res.status(404).json({ error: "not found" });
  res.json({ article: a });
});

// lightweight badge count (used by the floating chat bubble); works even if
// the feature is off (returns 0) so the UI never errors.
r.get("/unread", authRequired, (req, res) => {
  if (!isEnabled("support")) return res.json({ unread: 0, enabled: false });
  res.json({ unread: userUnreadCount(req.user.id), enabled: true });
});

// the user's conversation thread + available categories
r.get("/thread", authRequired, gate, (req, res) => {
  markUserRead(req.user.id);
  res.json({ ...myThread(req.user.id, L(req)), categories: CATEGORIES });
});

// send a message (opens a ticket if none / previous was resolved)
r.post("/message", authRequired, gate, (req, res) => {
  const body = String(req.body?.body || "").trim().slice(0, 4000);   // one message, not an essay
  const category = req.body?.category;
  if (!body) return res.status(400).json({ error: "empty" });
  userReply(req.user.id, body, category);
  res.json({ ...myThread(req.user.id, L(req)), categories: CATEGORIES });
});

export default r;
