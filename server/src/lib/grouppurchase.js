/* grouppurchase.js — Group purchase with a VOLUME discount.

   Design (agreed with the user): NOT a shared account. Instead, a buyer buys a
   PACK of several seats at a discounted per-seat price and receives one
   redemption CODE per seat. They hand the codes to friends; each friend redeems
   on their OWN independent account and gets their own premium time. This keeps
   every learner's progress/streak/SRS separate (no data mixing) while making
   each account cheaper when bought together.

   Research basis (SaaS volume discounting, 2025-2026): package/tiered pricing
   with a small number of clear tiers, per-seat price dropping as seats grow,
   and one redemption code per seat is the standard, low-friction pattern.

   Pricing model = PACKAGE pricing: the admin sets a fixed total price per pack
   (already discounted), so the per-seat price is simply price/seats. We expose
   that per-seat number + the % saved vs the single monthly plan so the value is
   obvious. Everything is admin-editable. All writes flush via persistNow(). */
import { db, persistNow } from "./../db.js";
import crypto from "crypto";
import { applyPremiumDays } from "./entitlement.js";

/* ---------- packs (admin catalog) ---------- */
export function listPacks({ activeOnly = false } = {}) {
  const where = activeOnly ? "WHERE active=1" : "";
  return db.prepare(`SELECT * FROM group_packs ${where} ORDER BY ord ASC, seats ASC, id ASC`).all();
}
export function serializePack(p, singleMonthlyRial = 0) {
  const perSeat = p.seats > 0 ? Math.round(p.price / p.seats) : p.price;
  // savings vs buying the single plan `days`-equivalent individually
  let savedPct = 0;
  if (singleMonthlyRial > 0 && p.days > 0) {
    const individual = Math.round(singleMonthlyRial * (p.days / 30)) * p.seats;
    if (individual > 0) savedPct = Math.max(0, Math.round((1 - p.price / individual) * 100));
  }
  return {
    id: p.id, title_fa: p.title_fa, title_en: p.title_en,
    seats: p.seats, days: p.days, price: p.price,
    perSeat, savedPct, active: !!p.active, ord: p.ord,
  };
}
export function createPack(d = {}) {
  const info = db.prepare(`INSERT INTO group_packs (title_fa,title_en,seats,days,price,ord,active)
    VALUES (?,?,?,?,?,?,?)`).run(
    d.title_fa || null, d.title_en || null,
    Math.max(2, d.seats | 0 || 2), Math.max(1, d.days | 0 || 30),
    Math.max(0, d.price | 0), d.ord | 0, d.active === 0 ? 0 : 1);
  persistNow();
  return db.prepare("SELECT * FROM group_packs WHERE id=?").get(info.lastInsertRowid);
}
export function updatePack(id, d = {}) {
  const cur = db.prepare("SELECT * FROM group_packs WHERE id=?").get(id);
  if (!cur) return null;
  const m = (k, def) => (d[k] === undefined ? def : d[k]);
  db.prepare(`UPDATE group_packs SET title_fa=?,title_en=?,seats=?,days=?,price=?,ord=?,active=? WHERE id=?`).run(
    m("title_fa", cur.title_fa), m("title_en", cur.title_en),
    Math.max(2, (m("seats", cur.seats) | 0) || 2), Math.max(1, (m("days", cur.days) | 0) || 30),
    Math.max(0, m("price", cur.price) | 0), m("ord", cur.ord) | 0, m("active", cur.active) ? 1 : 0, id);
  persistNow();
  return db.prepare("SELECT * FROM group_packs WHERE id=?").get(id);
}
export function deletePack(id) {
  db.prepare("DELETE FROM group_packs WHERE id=?").run(id);
  persistNow();
  return true;
}
export function getPack(id) { return db.prepare("SELECT * FROM group_packs WHERE id=?").get(id); }

/* ---------- orders ---------- */
/* Create a PENDING order for a pack (the payment route drives it to paid). */
export function createOrder(buyerId, pack) {
  const info = db.prepare(`INSERT INTO group_orders (buyer_id,pack_id,seats,days,amount,status)
    VALUES (?,?,?,?,?, 'pending')`).run(buyerId, pack.id, pack.seats, pack.days, pack.price);
  persistNow();
  return db.prepare("SELECT * FROM group_orders WHERE id=?").get(info.lastInsertRowid);
}
export function linkTransaction(orderId, txId) {
  db.prepare("UPDATE group_orders SET transaction_id=? WHERE id=?").run(txId, orderId);
  persistNow();
}
export function getOrder(id) { return db.prepare("SELECT * FROM group_orders WHERE id=?").get(id); }

/* Mark an order paid and generate one seat code per seat (idempotent). */
export function markOrderPaid(orderId) {
  const o = getOrder(orderId);
  if (!o) return null;
  // Atomic claim so two Zarinpal retries cannot mint a second set of seat codes.
  const claimed = db.prepare(
    "UPDATE group_orders SET status='paid', paid_at=datetime('now') WHERE id=? AND status!='paid'"
  ).run(orderId);
  if (!claimed.changes) return getOrder(orderId);
  const ins = db.prepare("INSERT INTO seat_codes (order_id, code, days, status) VALUES (?,?,?, 'active')");
  for (let i = 0; i < o.seats; i++) ins.run(orderId, genCode(), o.days);
  persistNow();
  return getOrder(orderId);
}

function genCode() {
  // human-friendly, unambiguous alphabet; retry on the (extremely rare) clash
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 20; tries++) {
    let s = "";
    for (let i = 0; i < 8; i++) s += A[crypto.randomInt(A.length)];
    const code = "MED-" + s.slice(0, 4) + "-" + s.slice(4);
    if (!db.prepare("SELECT 1 FROM seat_codes WHERE code=?").get(code)) return code;
  }
  return "MED-" + Date.now().toString(36).toUpperCase();
}

/* Buyer's orders with their codes + redemption status. */
export function ordersForBuyer(buyerId) {
  const orders = db.prepare("SELECT * FROM group_orders WHERE buyer_id=? ORDER BY id DESC").all(buyerId);
  return orders.map((o) => ({
    id: o.id, seats: o.seats, days: o.days, amount: o.amount, status: o.status,
    created_at: o.created_at, paid_at: o.paid_at,
    codes: db.prepare(`SELECT sc.code, sc.status, sc.redeemed_at, u.name_fa, u.name_en, u.username
                       FROM seat_codes sc LEFT JOIN users u ON u.id=sc.redeemed_by
                       WHERE sc.order_id=? ORDER BY sc.id`).all(o.id)
      .map((c) => ({
        code: c.code, status: c.status, redeemed_at: c.redeemed_at,
        redeemed_by: c.status === "redeemed" ? (c.name_fa || c.name_en || c.username || "—") : null,
      })),
  }));
}

/* ---------- redemption (each redeemer's OWN account) ---------- */
export function redeemCode(userId, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "empty" };
  const sc = db.prepare("SELECT * FROM seat_codes WHERE code=?").get(code);
  if (!sc) return { ok: false, error: "not_found" };
  if (sc.status === "redeemed") return { ok: false, error: "already_used" };

  // Claim the seat first so two friends cannot redeem the same code.
  const claimed = db.prepare(
    "UPDATE seat_codes SET status='redeemed', redeemed_by=?, redeemed_at=datetime('now') WHERE id=? AND status!='redeemed'"
  ).run(userId, sc.id);
  if (!claimed.changes) return { ok: false, error: "already_used" };

  const profile = applyPremiumDays(userId, sc.days, { source: "group_code" });
  persistNow();
  return {
    ok: true,
    days: sc.days,
    premium_until: profile.premium_until || null,
    lifetime: !!(profile.premium && !profile.premium_until),
  };
}

/* Admin: all orders overview + stats. */
export function adminOrders() {
  const orders = db.prepare(`
    SELECT o.*, u.name_fa, u.name_en, u.username,
      (SELECT COUNT(*) FROM seat_codes WHERE order_id=o.id) total_codes,
      (SELECT COUNT(*) FROM seat_codes WHERE order_id=o.id AND status='redeemed') redeemed_codes
    FROM group_orders o LEFT JOIN users u ON u.id=o.buyer_id
    ORDER BY o.id DESC LIMIT 200`).all();
  return orders.map((o) => ({
    id: o.id, buyer: o.name_fa || o.name_en || o.username || "—",
    seats: o.seats, days: o.days, amount: o.amount, status: o.status,
    total_codes: o.total_codes, redeemed_codes: o.redeemed_codes,
    created_at: o.created_at, paid_at: o.paid_at,
  }));
}
export function adminStats() {
  const paid = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) rev FROM group_orders WHERE status='paid'").get();
  const seats = db.prepare("SELECT COALESCE(SUM(seats),0) c FROM group_orders WHERE status='paid'").get();
  const redeemed = db.prepare("SELECT COUNT(*) c FROM seat_codes WHERE status='redeemed'").get();
  return {
    paidOrders: paid.c, revenue: paid.rev,
    seatsSold: seats.c, seatsRedeemed: redeemed.c,
    redeemRate: seats.c ? Math.round((redeemed.c / seats.c) * 100) : 0,
  };
}
