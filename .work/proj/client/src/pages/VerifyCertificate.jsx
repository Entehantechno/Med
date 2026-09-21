import { useState, useEffect } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { fmtDateLong } from "../utils/date.js";

/* Public certificate verification page (no login). Reachable at /verify/:serial
   or /verify — anyone (employer, school) can confirm a MED School credential. */
export default function VerifyCertificate({ serial: initialSerial, onHome }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const [serial, setSerial] = useState(initialSerial || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doVerify = async (s) => {
    const code = (s ?? serial).trim().toUpperCase();
    if (!code) return;
    setLoading(true); setSearched(true);
    try { const r = await api.get(`/site-content/verify/${encodeURIComponent(code)}?lang=${fa ? "fa" : "en"}`); setResult(r); }
    catch { setResult({ valid: false }); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (initialSerial) doVerify(initialSerial); }, [initialSerial]);

  return (
    <div className="verify-wrap">
      <header className="blog-top">
        <button className="blog-brand" onClick={onHome}>
          <span className="lp-logo"><Icon name="cap" size={22} /></span>
          <span className="lp-brand-name">MED School</span>
        </button>
      </header>

      <div className="verify-body">
        <div className="verify-card">
          <div className="verify-icon">🔎</div>
          <h1>{fa ? "استعلام گواهی‌نامه" : "Verify a certificate"}</h1>
          <p className="verify-sub">{fa ? "شناسهٔ گواهی را وارد کنید تا اصالت آن را بررسی کنیم." : "Enter the certificate ID to confirm its authenticity."}</p>
          <div className="verify-search">
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="MED-2026-XXXXXX"
              onKeyDown={(e) => e.key === "Enter" && doVerify()} />
            <button className="lp-btn-primary" onClick={() => doVerify()} disabled={loading}>
              {loading ? (fa ? "بررسی…" : "Checking…") : (fa ? "استعلام" : "Verify")}
            </button>
          </div>

          {searched && !loading && result && (
            result.valid ? (
              <div className="verify-result ok">
                <div className="verify-badge">✓ {fa ? "معتبر است" : "Valid"}</div>
                <table className="verify-table">
                  <tbody>
                    <tr><td>{fa ? "دریافت‌کننده" : "Recipient"}</td><td><b>{result.recipient}</b></td></tr>
                    <tr><td>{fa ? "دوره" : "Program"}</td><td>{result.title}</td></tr>
                    <tr><td>{fa ? "صادرکننده" : "Issuer"}</td><td>{result.org}</td></tr>
                    <tr><td>{fa ? "تاریخ صدور" : "Issued"}</td><td>{fmtDateLong(result.issued_at, fa ? "fa" : "en")}</td></tr>
                    <tr><td>{fa ? "شناسه" : "ID"}</td><td>{result.serial}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : result.revoked ? (
              <div className="verify-result bad"><div className="verify-badge bad">⚠ {fa ? "این گواهی باطل شده است" : "This certificate was revoked"}</div></div>
            ) : (
              <div className="verify-result bad"><div className="verify-badge bad">✕ {fa ? "گواهی‌ای با این شناسه یافت نشد" : "No certificate found for this ID"}</div></div>
            )
          )}
        </div>
        <div className="verify-foot">{fa ? "MED School — گواهی‌نامه‌های قابل استعلام" : "MED School — verifiable credentials"}</div>
      </div>
    </div>
  );
}
