import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

export default function Premium({ onProfile }) {
  const { t, lang, flag } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState(null);   // { enabled, packs }
  const [myOrders, setMyOrders] = useState([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState(null);

  const load = () => {
    api.get(`/learn/premium/plans?lang=${lang}`).then(setData).catch(() => setData({ plans: [], perks: [] }));
    api.get(`/learn/profile?lang=${lang}`).then((d) => { setProfile(d.profile); onProfile?.(d.profile); }).catch(() => {});
    api.get("/pay/history").then(setHistory).catch(() => setHistory(null));
    // Recover a bank redirect that never came back (user closed the tab).
    api.post("/pay/reconcile").then((r) => {
      if (r?.profile) { setProfile(r.profile); onProfile?.(r.profile); }
      if (r?.recovered) load();
    }).catch(() => {});
    if (flag("group_purchase")) {
      api.get("/pay/group/packs").then(setGroup).catch(() => setGroup({ enabled: false, packs: [] }));
      api.get("/pay/group/orders").then((d) => setMyOrders(d.orders || [])).catch(() => {});
    }
  };
  useEffect(() => { load(); }, [lang]);

  const buyPack = async (packId) => {
    setBusy(true);
    try {
      const { url } = await api.post("/pay/group/checkout", { packId });
      if (url) window.location.href = url;
    } catch { alert(fa ? "خطا در اتصال به درگاه پرداخت" : "Payment gateway error"); setBusy(false); }
  };
  const doRedeem = async () => {
    setRedeemMsg(null);
    try {
      const r = await api.post("/pay/group/redeem", { code: redeemCode });
      setRedeemMsg({ ok: true, text: fa ? `کد با موفقیت فعال شد! ${r.days} روز پریمیوم به حساب شما اضافه شد.` : `Code redeemed! ${r.days} days of premium added.` });
      setRedeemCode(""); load();
    } catch (e) {
      const map = { not_found: fa ? "کد یافت نشد." : "Code not found.", already_used: fa ? "این کد قبلاً استفاده شده." : "This code was already used.", empty: fa ? "کد را وارد کنید." : "Enter a code." };
      setRedeemMsg({ ok: false, text: map[String(e.message)] || (fa ? "کد نامعتبر است." : "Invalid code.") });
    }
  };
  const copyCode = (c) => { try { navigator.clipboard.writeText(c); } catch { /* */ } };

  // Start checkout: get the gateway URL from the server, then send the browser there.
  const subscribe = async (plan) => {
    setBusy(true);
    try {
      const { url } = await api.post("/pay/subscribe", { plan });
      if (url) window.location.href = url;      // go to the (real or mock) payment page
    } catch (e) {
      if (e?.data?.error === "lifetime" || e?.status === 409) {
        alert(t("alreadyLifetime"));
      } else {
        alert(lang === "fa" ? "خطا در اتصال به درگاه پرداخت" : "Payment gateway error");
      }
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!window.confirm(t("cancelSubConfirm"))) return;
    setBusy(true);
    try { const { profile } = await api.post("/learn/premium/cancel"); setProfile(profile); onProfile?.(profile); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>;
  const fmtDate = (iso) => iso ? new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(iso)) : "";

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="crown" size={22} /> {t("premiumTitle")}</h2></div>

      {profile?.premium ? (
        <div className="card center" style={{ background: "linear-gradient(135deg,#f0c454,#d0982a)", color: "#fff" }}>
          <Icon name="crown" size={40} />
          <h3 style={{ border: "none", color: "#fff", marginTop: 8 }}>{t("subscribed")}</h3>
          {profile.premium_until
            ? <div style={{ opacity: .95 }}>{t("premiumUntil")}: {fmtDate(profile.premium_until)}</div>
            : <div style={{ opacity: .95 }}>{t("premiumLifetime")}</div>}
          {!!profile.premium_until && (
            <button className="btn btn-ghost mt16" style={{ background: "rgba(255,255,255,.9)" }} disabled={busy} onClick={cancel}>{t("cancelSub")}</button>
          )}
        </div>
      ) : (
        <div className="card mb16">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{t("premiumDesc")}</div>
          {data.perks.map((p, i) => (
            <div className="perk" key={i}><Icon name="check" size={18} /> {p}</div>
          ))}
        </div>
      )}

      {!(profile?.premium && !profile.premium_until) && (
        <>
          {!!profile?.premium && <div className="section-title mt16"><h4><Icon name="crown" size={16} /> {t("extendPremium")}</h4></div>}
          <div className="grid grid-2">
            {data.plans.map((pl) => (
              <div key={pl.id} className={`plan-card ${pl.best ? "best" : ""}`}>
                {pl.best && <span className="badge-best">{t("bestValue")}</span>}
                <div className="plan-price">{lang === "fa" ? pl.price : pl.priceEn}</div>
                <div className="muted small" style={{ marginBottom: 16 }}>{pl.period}</div>
                <button className={`btn btn-block ${pl.best ? "btn-accent" : "btn-primary"}`} disabled={busy} onClick={() => subscribe(pl.id)}>
                  <Icon name="crown" size={16} /> {busy ? t("redirecting") : (profile?.premium ? t("extendPremium") : t("subscribe"))}
                </button>
              </div>
            ))}
          </div>
          <div className="small muted center mt16"><Icon name="shield" size={14} /> {t("securePayNote")}</div>
        </>
      )}

      {/* ---- Redeem a group seat code (works even if you're already premium) ---- */}
      {flag("group_purchase") && group?.enabled && (
        <div className="card mt16">
          <div className="section-title"><h4><Icon name="key" size={16} /> {fa ? "کد دعوت گروهی دارید؟" : "Have a group code?"}</h4></div>
          <div className="muted small" style={{ marginBottom: 10 }}>
            {fa ? "اگر دوستی برای شما یک کد خرید گروهی فرستاده، اینجا واردش کنید تا پریمیوم حساب خودتان فعال شود." : "If a friend sent you a group code, enter it here to activate premium on your own account."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} placeholder="MED-XXXX-XXXX"
              style={{ flex: 1, minWidth: 180, textTransform: "uppercase", direction: "ltr", textAlign: "center", letterSpacing: 1 }} />
            <button className="btn btn-primary" onClick={doRedeem} disabled={!redeemCode.trim()}>
              <Icon name="check" size={15} /> {fa ? "فعال‌سازی" : "Redeem"}
            </button>
          </div>
          {redeemMsg && (
            <div className={redeemMsg.ok ? "note-ok" : "err-banner"} style={{ marginTop: 10, borderRadius: 8, padding: "8px 12px", background: redeemMsg.ok ? "#e7f7ef" : undefined, color: redeemMsg.ok ? "#12805a" : undefined }}>
              {redeemMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ---- Group purchase packs (volume discount → cheaper independent accounts) ---- */}
      {flag("group_purchase") && group?.enabled && group.packs?.length > 0 && (
        <div className="card mt16">
          <div className="section-title"><h4><Icon name="users" size={16} /> {fa ? "خرید گروهی (ارزان‌تر برای هر نفر)" : "Group purchase (cheaper per person)"}</h4></div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            {fa
              ? "هر نفر اکانت مستقل خودش را دارد (پیشرفت و استریک قاطی نمی‌شود). یک بسته بخر، کدها را به دوستانت بده، و همه با هزینهٔ کمتر پریمیوم شوید."
              : "Everyone keeps their own independent account (no mixed progress). Buy a pack, hand the codes to friends, and everyone gets premium for less."}
          </div>
          <div className="grid grid-2">
            {group.packs.map((p) => (
              <div key={p.id} className="plan-card">
                {p.savedPct > 0 && <span className="badge-best">{fa ? `${p.savedPct.toLocaleString("fa-IR")}٪ تخفیف` : `${p.savedPct}% off`}</span>}
                <div style={{ fontWeight: 800 }}>{fa ? p.title_fa : p.title_en}</div>
                <div className="muted small">{fa ? `${p.seats.toLocaleString("fa-IR")} اکانت مستقل · ${p.days.toLocaleString("fa-IR")} روز` : `${p.seats} independent seats · ${p.days} days`}</div>
                <div className="plan-price" style={{ marginTop: 8 }}>{(p.price / 10).toLocaleString(fa ? "fa-IR" : "en-US")} {t("toman")}</div>
                <div className="muted small" style={{ marginBottom: 12 }}>
                  {fa ? `هر نفر: ${(p.perSeat / 10).toLocaleString("fa-IR")} تومان` : `${(p.perSeat / 10).toLocaleString("en-US")} T/seat`}
                </div>
                <button className="btn btn-block btn-primary" disabled={busy} onClick={() => buyPack(p.id)}>
                  <Icon name="users" size={15} /> {busy ? t("redirecting") : (fa ? "خرید این بسته" : "Buy pack")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- My group orders + their codes to distribute ---- */}
      {flag("group_purchase") && myOrders.length > 0 && (
        <div className="card mt16">
          <div className="section-title"><h4><Icon name="idcard" size={16} /> {fa ? "بسته‌های گروهی من (کدها را به دوستانت بده)" : "My group packs (share these codes)"}</h4></div>
          {myOrders.filter((o) => o.status === "paid").map((o) => (
            <div key={o.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>
                {fa ? `بستهٔ ${o.seats.toLocaleString("fa-IR")} نفره · ${o.days.toLocaleString("fa-IR")} روز` : `${o.seats}-seat pack · ${o.days} days`}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {o.codes.map((c) => (
                  <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", background: "var(--panel3, #f4f7fb)", borderRadius: 8, padding: "6px 10px" }}>
                    <code style={{ direction: "ltr", letterSpacing: 1, fontWeight: 700, textDecoration: c.status === "redeemed" ? "line-through" : "none", opacity: c.status === "redeemed" ? 0.55 : 1 }}>{c.code}</code>
                    {c.status === "redeemed"
                      ? <span className="tag small">{fa ? "استفاده‌شده" : "used"}{c.redeemed_by ? ` · ${c.redeemed_by}` : ""}</span>
                      : <button className="btn btn-ghost btn-sm" onClick={() => copyCode(c.code)}><Icon name="download" size={13} /> {fa ? "کپی" : "Copy"}</button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* payment history */}
      {history?.transactions?.length > 0 && (
        <div className="card mt16">
          <div className="section-title"><h4><Icon name="clock" size={16} /> {t("paymentHistory")}</h4>
            {!history.real && <span className="tag">{t("testGateway")}</span>}</div>
          <div className="table-wrap"><table>
            <thead><tr><th>{t("plan")}</th><th>{t("amount")}</th><th>{t("status")}</th><th>{t("dateTime")}</th></tr></thead>
            <tbody>{history.transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{String(tx.plan).startsWith("course:") ? t("store") : String(tx.plan).startsWith("group:") ? t("groupPurchase") : tx.plan === "yearly" ? t("yearly") : t("monthly")}</td>
                <td>{(tx.amount / 10).toLocaleString(lang === "fa" ? "fa-IR" : "en-US")} {t("toman")}</td>
                <td><span className={`pill pill-${tx.status === "paid" ? "active" : tx.status === "pending" ? "medium" : "danger"}`}>{t("pay_" + tx.status)}</span></td>
                <td className="small muted">{fmtDate(tx.paid_at || tx.created_at)}</td>
              </tr>
            ))}</tbody></table></div>
        </div>
      )}
    </div>
  );
}
