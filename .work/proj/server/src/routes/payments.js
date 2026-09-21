/* payments.js — Premium subscription checkout via Zarinpal (or mock gateway).
   Flow:
     POST /api/pay/subscribe {plan}  -> creates a pending transaction, returns { url }
     (browser goes to gateway; user pays)
     GET  /api/pay/callback?Authority&Status  -> verify, activate premium, redirect back
     GET  /api/pay/mock/:authority   -> simulated bank page (mock gateway only)
     GET  /api/pay/history           -> the user's transactions
   Amounts are in Rial. Prices come from getPlans(). */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { getProfile } from "../lib/gamify.js";
import { requestPayment, verifyPayment, GATEWAY, isReal, mockAllowed } from "../lib/zarinpal.js";
import { fulfillVerifiedTransaction, isLifetimePremium, notifyPremiumActivated, PREMIUM_ACTIVE_SQL } from "../lib/entitlement.js";
import {
  listPacks, serializePack, getPack, createOrder, linkTransaction, getOrder,
  markOrderPaid, ordersForBuyer, redeemCode,
} from "../lib/grouppurchase.js";
import { isEnabled } from "../lib/flags.js";
import { publicBaseUrl } from "../lib/publicurl.js";

const r = Router();

// plan catalog (amount in Rial; 1 Toman = 10 Rial).
// Admin can override the amounts via the settings key "plan_prices".
const DEFAULT_PLANS = {
  monthly: { days: 30, amount: 990000 },
  yearly: { days: 365, amount: 7900000 },
};
export function getPlans() {
  const out = { monthly: { ...DEFAULT_PLANS.monthly }, yearly: { ...DEFAULT_PLANS.yearly } };
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='plan_prices'").get();
    if (row) {
      const cfg = JSON.parse(row.value);
      if (Number(cfg.monthly) > 0) out.monthly.amount = Number(cfg.monthly);
      if (Number(cfg.yearly) > 0) out.yearly.amount = Number(cfg.yearly);
      if (Number(cfg.monthlyDays) > 0) out.monthly.days = Number(cfg.monthlyDays);
      if (Number(cfg.yearlyDays) > 0) out.yearly.days = Number(cfg.yearlyDays);
    }
  } catch { /* use defaults */ }
  return out;
}

/* Start checkout: create a pending transaction and return the gateway URL. */
r.post("/subscribe", authRequired, requireRole("learner"), async (req, res) => {
  if (!isEnabled("premium")) return res.status(403).json({ error: "feature disabled", flag: "premium" });
  const me = getProfile(req.user.id);
  if (isLifetimePremium(me)) {
    return res.status(409).json({ error: "lifetime", message_fa: "اشتراک شما مادام‌العمر است.", message_en: "You already have a lifetime membership." });
  }
  const plan = req.body?.plan === "yearly" ? "yearly" : "monthly";
  const info = getPlans()[plan];
  const description = `MED School Plus - ${plan}`;
  const callbackUrl = `${publicBaseUrl(req)}/api/pay/callback`;

  const pay = await requestPayment({
    amount: info.amount, description, callbackUrl,
    email: req.user.email || "", mobile: "",
  });
  if (!pay.ok) return res.status(502).json({ error: pay.error || "gateway error" });

  db.prepare(`INSERT INTO transactions (user_id, plan, amount, authority, status, gateway)
    VALUES (?,?,?,?, 'pending', ?)`).run(req.user.id, plan, info.amount, pay.authority, pay.gateway);
  persistNow();
  // real gateway gives an absolute URL; mock stays relative so it works on any host/port
  res.json({ url: pay.url, authority: pay.authority, gateway: pay.gateway });
});

/* Gateway callback: verify and (on success) activate premium, then redirect. */
r.get("/callback", async (req, res) => {
  const authority = req.query.Authority || req.query.authority;
  const status = req.query.Status || req.query.status;
  const tx = authority ? db.prepare("SELECT * FROM transactions WHERE authority=?").get(authority) : null;

  const back = (result) => res.redirect(`/?pay=${result}`);
  if (!tx) return back("notfound");
  if (tx.status === "paid") {
    // heal paid-but-not-granted (course enroll / group codes)
    try { settleVerifiedTx(tx, { refId: tx.ref_id }); } catch { /* */ }
    return back(String(tx.plan).startsWith("group:") ? "group" : "success");
  }

  if (status && String(status).toUpperCase() !== "OK") {
    db.prepare("UPDATE transactions SET status='canceled' WHERE id=? AND status='pending'").run(tx.id);
    persistNow();
    return back("canceled");
  }

  const v = await verifyPayment({ amount: tx.amount, authority });
  if (!v.ok) {
    // Transient (network) failures stay pending so /pay/reconcile can retry.
    if (!v.transient) {
      db.prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'").run(tx.id);
      persistNow();
    }
    return back("failed");
  }
  const out = settleVerifiedTx(tx, v);
  return back(out.group ? "group" : "success");
});

function settleVerifiedTx(tx, v) {
  const catalog = getPlans()[tx.plan];
  const out = fulfillVerifiedTransaction(tx, v, { plusDays: catalog?.days });
  if (out.kind === "group") {
    if (out.orderId) markOrderPaid(out.orderId);
    persistNow();
    return { group: true, already: !!out.already };
  }
  if (out.kind === "plus" && !out.already) notifyPremiumActivated(tx.user_id);
  return out;
}

/* Recover a paid-but-not-redirected checkout. Safe to call any time. */
r.post("/reconcile", authRequired, async (req, res) => {
  const pending = db.prepare("SELECT * FROM transactions WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 20").all(req.user.id);
  let recovered = 0;
  for (const tx of pending) {
    const v = await verifyPayment({ amount: tx.amount, authority: tx.authority });
    if (!v.ok) continue;
    const out = settleVerifiedTx(tx, v);
    if (!out.already) recovered++;
  }
  persistNow();
  res.json({ ok: true, recovered, profile: getProfile(req.user.id) });
});

/* Mock bank page (only used when no real merchant configured). */
r.get("/mock/:authority", (req, res) => {
  if (!mockAllowed()) return res.status(404).end();
  const authority = req.params.authority;
  const tx = db.prepare("SELECT * FROM transactions WHERE authority=?").get(authority);
  const toman = tx ? (tx.amount / 10).toLocaleString("fa-IR") : "—";
  const okUrl = `/api/pay/callback?Authority=${encodeURIComponent(authority)}&Status=OK`;
  const noUrl = `/api/pay/callback?Authority=${encodeURIComponent(authority)}&Status=NOK`;
  res.set("content-type", "text/html; charset=utf-8").send(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>درگاه آزمایشی</title>
<style>body{font-family:Tahoma,system-ui,sans-serif;background:#0e1730;color:#eaf1ff;display:grid;place-items:center;height:100vh;margin:0}
.card{background:#16213f;border:1px solid #294066;border-radius:18px;padding:28px;max-width:380px;width:92%;text-align:center;box-shadow:0 20px 50px -20px #000}
h1{font-size:1.2rem;margin:0 0 6px}.amt{font-size:1.6rem;font-weight:800;color:#4f93e8;margin:12px 0}
.note{background:#e6a33e22;color:#e6a33e;border-radius:10px;padding:8px 12px;font-size:.8rem;margin:14px 0}
button{border:none;border-radius:12px;padding:12px 18px;font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;width:100%;margin-top:8px}
.pay{background:linear-gradient(135deg,#2fc98d,#20b077);color:#fff}.cancel{background:transparent;color:#9fb3d1;border:1px solid #294066}</style></head>
<body><div class="card"><h1>💳 درگاه پرداخت آزمایشی</h1>
<div style="color:#9fb3d1;font-size:.85rem">MED School Plus</div>
<div class="amt">${toman} تومان</div>
<div class="note">⚠️ این یک درگاه شبیه‌سازی‌شده است (بدون پرداخت واقعی). برای فعال‌سازی درگاه واقعی، ZARINPAL_MERCHANT_ID را در فایل env تنظیم کنید.</div>
<a href="${okUrl}"><button class="pay">پرداخت موفق ✓</button></a>
<a href="${noUrl}"><button class="cancel">انصراف</button></a>
</div></body></html>`);
});

/* ================= GROUP PURCHASE (volume discount) =================
   Each redeemed seat activates the redeemer's OWN account — no shared logins. */

/* Public-ish: list active seat packs (with per-seat price + savings). */
r.get("/group/packs", (req, res) => {
  if (!isEnabled("group_purchase")) return res.json({ enabled: false, packs: [] });
  const singleMonthly = getPlans().monthly.amount;
  const packs = listPacks({ activeOnly: true }).map((p) => serializePack(p, singleMonthly));
  res.json({ enabled: true, packs, singleMonthly });
});

/* Start a group checkout: create a pending order + transaction, return the URL. */
r.post("/group/checkout", authRequired, requireRole("learner"), async (req, res) => {
  if (!isEnabled("group_purchase")) return res.status(403).json({ error: "disabled" });
  const pack = getPack(parseInt(req.body?.packId, 10));
  if (!pack || !pack.active) return res.status(404).json({ error: "pack_not_found" });
  if (!Number(pack.price) || Number(pack.price) <= 0) return res.status(400).json({ error: "invalid_price" });

  const order = createOrder(req.user.id, pack);
  const description = `MED School — Group pack (${pack.seats} seats)`;
  const callbackUrl = `${publicBaseUrl(req)}/api/pay/callback`;
  const pay = await requestPayment({ amount: pack.price, description, callbackUrl, email: req.user.email || "", mobile: "" });
  if (!pay.ok) return res.status(502).json({ error: pay.error || "gateway error" });

  const info = db.prepare(`INSERT INTO transactions (user_id, plan, amount, authority, status, gateway)
    VALUES (?,?,?,?, 'pending', ?)`).run(req.user.id, `group:${order.id}`, pack.price, pay.authority, pay.gateway);
  linkTransaction(order.id, info.lastInsertRowid);
  persistNow();
  res.json({ url: pay.url, authority: pay.authority, gateway: pay.gateway, orderId: order.id });
});

/* The buyer's group orders + their seat codes (to distribute to friends). */
r.get("/group/orders", authRequired, (req, res) => {
  res.json({ orders: ordersForBuyer(req.user.id) });
});

/* Redeem a seat code → activates the CURRENT user's own premium. */
r.post("/group/redeem", authRequired, requireRole("learner"), (req, res) => {
  if (!isEnabled("group_purchase")) return res.status(403).json({ error: "disabled" });
  const result = redeemCode(req.user.id, req.body?.code);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/* Transaction history for the current user. */
r.get("/history", authRequired, (req, res) => {
  const rows = db.prepare("SELECT id, plan, amount, ref_id, status, gateway, created_at, paid_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 50").all(req.user.id);
  res.json({ transactions: rows, gateway: GATEWAY, real: isReal() });
});

/* Admin: all transactions + revenue summary. */
r.get("/admin/all", authRequired, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  const rows = db.prepare(`SELECT t.*, u.name_fa, u.name_en, u.username FROM transactions t
    LEFT JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200`).all();
  const paid = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) sum FROM transactions WHERE status='paid'").get();
  const activeSubs = db.prepare(`SELECT COUNT(*) n FROM learner_profiles WHERE ${PREMIUM_ACTIVE_SQL}`).get().n;
  res.json({
    transactions: rows, gateway: GATEWAY, real: isReal(),
    revenue: { paidCount: paid.n, totalRial: paid.sum, totalToman: Math.round(paid.sum / 10), activeSubs },
  });
});

export default r;
