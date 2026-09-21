/* zarinpal.js — Zarinpal Payment Gateway (API v4) with a built-in mock fallback.

   Real mode (when ZARINPAL_MERCHANT_ID is set):
     - request:  POST {base}/pg/v4/payment/request.json  -> { authority }
     - redirect: {base}/pg/StartPay/{authority}
     - verify:   POST {base}/pg/v4/payment/verify.json    -> { code:100/101, ref_id }
   Sandbox uses sandbox.zarinpal.com; production uses payment.zarinpal.com.

   Mock mode (no merchant id configured — the default for local/dev):
     - request returns a fake authority + a local redirect to /api/pay/mock/{authority}
       which simulates the bank page and then bounces back to the callback.
   This lets the whole subscription flow be built & tested end-to-end without a
   real merchant account, and switch to real payments by just setting env vars. */

const MERCHANT = process.env.ZARINPAL_MERCHANT_ID || "";
const SANDBOX = String(process.env.ZARINPAL_SANDBOX || "").toLowerCase() === "true";
export const GATEWAY = MERCHANT ? "zarinpal" : "mock";

function base() {
  return SANDBOX ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
}
export function isReal() { return !!MERCHANT; }
/** Mock checkout is for local/tests only. Production must have a merchant id
    (or an explicit ALLOW_MOCK_PAY=1 escape hatch) or we would give Plus away. */
export function mockAllowed() {
  if (MERCHANT) return false;
  if (process.env.ALLOW_MOCK_PAY === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/* Create a payment request. Returns { ok, authority, url } or { ok:false, error }. */
export async function requestPayment({ amount, description, callbackUrl, mobile, email }) {
  const amt = Math.round(Number(amount) || 0);
  // Zarinpal rejects non-integer / sub-1000-Rial amounts; a 0-Rial request
  // would otherwise mint a MOCK authority and give the product away.
  if (!Number.isFinite(amt) || amt < 1000) return { ok: false, error: "invalid_amount" };
  amount = amt;
  if (!MERCHANT) {
    if (!mockAllowed()) return { ok: false, error: "gateway_not_configured" };
    const authority = "MOCK" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return { ok: true, authority, url: `/api/pay/mock/${authority}`, gateway: "mock" };
  }
  try {
    const res = await fetch(`${base()}/pg/v4/payment/request.json`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),   // a hung gateway must not hang the checkout
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        merchant_id: MERCHANT, amount, callback_url: callbackUrl, description,
        metadata: { mobile: mobile || "", email: email || "" },
      }),
    });
    const json = await res.json();
    if (json?.data?.code === 100 && json.data.authority) {
      return { ok: true, authority: json.data.authority, url: `${base()}/pg/StartPay/${json.data.authority}`, gateway: "zarinpal" };
    }
    return { ok: false, error: json?.errors?.message || "request failed", raw: json };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* Verify a payment. Returns { ok, refId, code } or { ok:false, error }. */
export async function verifyPayment({ amount, authority }) {
  if (String(authority || "").startsWith("MOCK")) {
    // Never honour leftover MOCK authorities after a real merchant is configured.
    if (!mockAllowed()) return { ok: false, transient: false, error: "mock_disabled" };
    return { ok: true, refId: "MOCKREF" + Math.floor(Math.random() * 1e9), code: 100, gateway: "mock" };
  }
  if (!MERCHANT) return { ok: false, transient: false, error: "gateway_not_configured" };
  try {
    const res = await fetch(`${base()}/pg/v4/payment/verify.json`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),   // timeout → transient → /pay/reconcile retries
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ merchant_id: MERCHANT, amount, authority }),
    });
    const json = await res.json();
    const code = json?.data?.code;
    if (code === 100 || code === 101) return { ok: true, refId: String(json.data.ref_id), code, gateway: "zarinpal" };
    return { ok: false, transient: false, error: json?.errors?.message || "verify failed", code, raw: json };
  } catch (e) {
    // Network / timeout: leave the tx pending so /pay/reconcile can retry.
    return { ok: false, transient: true, error: String(e.message || e) };
  }
}
