/* support.js — In-app support & feedback chat.
   Any authenticated user opens a ticket (question / bug / feedback / account),
   exchanges chat messages with the admin team, and gets a bell notification when
   an agent replies. Admins see an inbox with full conversation context, reply,
   change category, and resolve. Small, dependency-free, persists to SQLite. */
import { db, persistNow } from "../db.js";
import { notify } from "./notify.js";

export const CATEGORIES = ["question", "bug", "feedback", "account"];
const cat = (c) => (CATEGORIES.includes(c) ? c : "question");
const nameOf = (u, lang) => (u ? (lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa)) : "") || u?.username || "";

/* ---------------- user side ---------------- */

// Create a ticket with its first message. Returns the ticket id.
export function openTicket(userId, { category, subject, body }) {
  const info = db.prepare(`INSERT INTO support_tickets (user_id, category, subject, status, user_unread, admin_unread)
      VALUES (?,?,?, 'open', 0, 1)`).run(userId, cat(category), String(subject || "").slice(0, 120));
  const ticketId = info.lastInsertRowid;
  addMessage(ticketId, "user", userId, "", body);
  persistNow();
  return ticketId;
}

function addMessage(ticketId, sender, senderId, senderName, body) {
  db.prepare(`INSERT INTO support_messages (ticket_id, sender, sender_id, sender_name, body)
      VALUES (?,?,?,?,?)`).run(ticketId, sender, senderId || null, senderName || "", String(body || "").slice(0, 4000));
  db.prepare("UPDATE support_tickets SET last_message_at=datetime('now') WHERE id=?").run(ticketId);
}

// The learner's own open/most-recent conversation (single-thread chat UX).
export function myThread(userId, lang = "fa") {
  const ticket = db.prepare(`SELECT * FROM support_tickets WHERE user_id=? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!ticket) return { ticket: null, messages: [] };
  const messages = db.prepare(`SELECT id, sender, sender_name, body, created_at FROM support_messages WHERE ticket_id=? ORDER BY id ASC`).all(ticket.id);
  return { ticket: shapeTicket(ticket), messages };
}

// User posts a reply into their latest ticket (or opens one if none exists).
export function userReply(userId, body, category) {
  let ticket = db.prepare(`SELECT * FROM support_tickets WHERE user_id=? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!ticket || ticket.status === "resolved") {
    const id = openTicket(userId, { category: category || ticket?.category, subject: "", body });
    return db.prepare("SELECT * FROM support_tickets WHERE id=?").get(id);
  }
  addMessage(ticket.id, "user", userId, "", body);
  db.prepare("UPDATE support_tickets SET status='open', admin_unread=admin_unread+1 WHERE id=?").run(ticket.id);
  persistNow();
  return db.prepare("SELECT * FROM support_tickets WHERE id=?").get(ticket.id);
}

// Mark admin replies as seen by the user (called when the user opens the chat).
export function markUserRead(userId) {
  db.prepare("UPDATE support_tickets SET user_unread=0 WHERE user_id=?").run(userId);
  persistNow();
}

// Count of admin replies the user hasn't seen (drives the chat-bubble badge).
export function userUnreadCount(userId) {
  return db.prepare("SELECT COALESCE(SUM(user_unread),0) c FROM support_tickets WHERE user_id=?").get(userId).c;
}

/* ---------------- admin side ---------------- */

export function listTickets(lang = "fa", statusFilter = "") {
  const where = statusFilter && ["open", "answered", "resolved"].includes(statusFilter) ? "WHERE t.status=?" : "";
  const args = where ? [statusFilter] : [];
  const rows = db.prepare(`
    SELECT t.*, u.name_fa, u.name_en, u.username, u.role,
      (SELECT body FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_body
    FROM support_tickets t JOIN users u ON u.id=t.user_id
    ${where}
    ORDER BY (t.admin_unread>0) DESC, t.last_message_at DESC`).all(...args);
  return rows.map((t) => ({ ...shapeTicket(t), user: nameOf(t, lang), username: t.username, role: t.role, lastBody: t.last_body }));
}

export function adminThread(ticketId, lang = "fa") {
  const t = db.prepare(`SELECT t.*, u.name_fa, u.name_en, u.username, u.role, u.email
      FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?`).get(ticketId);
  if (!t) return null;
  const messages = db.prepare(`SELECT id, sender, sender_name, body, created_at FROM support_messages WHERE ticket_id=? ORDER BY id ASC`).all(ticketId);
  return {
    ticket: { ...shapeTicket(t), user: nameOf(t, lang), username: t.username, role: t.role, email: t.email },
    messages,
  };
}

// Admin replies → notifies the user, marks the ticket "answered".
export function adminReply(ticketId, adminId, adminName, body) {
  const t = db.prepare("SELECT * FROM support_tickets WHERE id=?").get(ticketId);
  if (!t) return { ok: false, error: "not found" };
  addMessage(ticketId, "admin", adminId, adminName || "", body);
  db.prepare("UPDATE support_tickets SET status='answered', user_unread=user_unread+1, admin_unread=0 WHERE id=?").run(ticketId);
  notify(t.user_id, {
    kind: "system", icon: "chat", link: "support",
    title_fa: "💬 پاسخ پشتیبانی", title_en: "💬 Support replied",
    body_fa: "تیم پشتیبانی به پیام شما پاسخ داد.", body_en: "The support team answered your message.",
  });
  persistNow();
  return { ok: true };
}

export function markAdminRead(ticketId) {
  db.prepare("UPDATE support_tickets SET admin_unread=0 WHERE id=?").run(ticketId);
  persistNow();
}

export function setStatus(ticketId, status) {
  const s = ["open", "answered", "resolved"].includes(status) ? status : "open";
  db.prepare("UPDATE support_tickets SET status=? WHERE id=?").run(s, ticketId);
  persistNow();
  return s;
}

export function setCategory(ticketId, category) {
  db.prepare("UPDATE support_tickets SET category=? WHERE id=?").run(cat(category), ticketId);
  persistNow();
}

// Inbox KPIs for the admin overview + support tab header.
export function supportStats() {
  const total = db.prepare("SELECT COUNT(*) c FROM support_tickets").get().c;
  const open = db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status='open'").get().c;
  const unread = db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE admin_unread>0").get().c;
  const resolved = db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status='resolved'").get().c;
  const byCat = db.prepare("SELECT category, COUNT(*) c FROM support_tickets GROUP BY category").all();
  return { total, open, unread, resolved, byCat };
}

function shapeTicket(t) {
  return {
    id: t.id, user_id: t.user_id, category: t.category, subject: t.subject,
    status: t.status, user_unread: t.user_unread, admin_unread: t.admin_unread,
    last_message_at: t.last_message_at, created_at: t.created_at,
  };
}
