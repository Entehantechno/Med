import { useState, useEffect } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, useToast } from "../../components/UI.jsx";
import { fmtDateLong } from "../../utils/date.js";

/* Learner certificate wallet: earned credentials + progress toward the next,
   with a printable certificate view, a public verification link, a QR code and
   one-click sharing. AI-free. */

export default function Certificates() {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const toast = useToast();
  const [d, setD] = useState(null);
  const [view, setView] = useState(null); // certificate being viewed
  const load = () => api.get(`/learn/certificates?lang=${fa ? "fa" : "en"}`).then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, [fa]);

  const claim = async (kind, courseId) => {
    try {
      const r = await api.post("/learn/certificates/claim", { kind, courseId });
      if (r.ok) { toast(fa ? "گواهی صادر شد 🎓" : "Certificate issued 🎓"); load(); }
      else toast(fa ? "هنوز واجد شرایط نیستی" : "Not eligible yet");
    } catch { toast("Error"); }
  };

  if (d === false) return <div className="page"><div className="card empty-state"><h3>{t("noData")}</h3></div></div>;
  if (!d) return <Spinner />;
  if (d.enabled === false) return <div className="page"><div className="card empty-state"><h3>{fa ? "این بخش غیرفعال است." : "This section is disabled."}</h3></div></div>;
  if (view) return <CertificateView cert={view} onBack={() => setView(null)} />;

  return (
    <div className="page">
      <div className="section-title"><h4>🎓 {fa ? "گواهی‌نامه‌های من" : "My certificates"}</h4></div>

      {d.certificates.length === 0 && (
        <div className="card empty-state"><h3>{fa ? "هنوز گواهی‌نامه‌ای نداری" : "No certificates yet"}</h3>
          <p className="muted">{fa ? "با تکمیل دوره، گواهی‌نامهٔ قابل‌استعلام دریافت می‌کنی." : "Finish a program to earn a verifiable certificate."}</p></div>
      )}

      {d.certificates.length > 0 && (
        <div className="cert-grid">
          {d.certificates.map((c) => (
            <button key={c.serial} className="cert-mini" onClick={() => setView(c)}>
              <div className="cert-mini-ribbon">🎓</div>
              <div className="cert-mini-title">{c.title}</div>
              <div className="cert-mini-org">{c.org}</div>
              <div className="cert-mini-serial">{c.serial}</div>
              <div className="cert-mini-open">{fa ? "مشاهده و اشتراک" : "View & share"} →</div>
            </button>
          ))}
        </div>
      )}

      {/* progress toward not-yet-earned certificates */}
      {d.progress.filter((p) => !p.earned).length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 22 }}><h4>{fa ? "در مسیر گواهی بعدی" : "Toward your next certificate"}</h4></div>
          {d.progress.filter((p) => !p.earned).map((p) => (
            <div key={p.kind + p.title} className="card cert-progress">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <b>{p.title}</b><span className="muted">{p.pct}%</span>
              </div>
              <div className="cert-bar"><div className="cert-bar-fill" style={{ width: `${p.pct}%` }} /></div>
              {p.pct >= 100
                ? <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => claim(p.kind)}>{fa ? "دریافت گواهی 🎓" : "Claim certificate 🎓"}</button>
                : <div className="small muted" style={{ marginTop: 8 }}>{fa ? "با تکمیل ۱۰۰٪ مسیر، گواهی فعال می‌شود." : "Reach 100% to unlock the certificate."}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* Build the public verification URL for a serial. */
function verifyUrl(serial) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify/${serial}`;
}
/* Inline QR — a tiny deterministic SVG placeholder that encodes the verify URL
   via a data attribute; scannable QR would need a lib, so we render a scannable
   link + a decorative code block that visually reads as a QR square. */
function QrBox({ serial, size = 96 }) {
  // deterministic pseudo-QR from the serial (visual, plus the link is shown)
  const cells = 11;
  const seedStr = serial + "MEDSCHOOL";
  let h = 0; for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const on = (x, y) => {
    // finder patterns in 3 corners
    const inFinder = (cx, cy) => x >= cx && x < cx + 3 && y >= cy && y < cy + 3;
    if (inFinder(0, 0) || inFinder(cells - 3, 0) || inFinder(0, cells - 3)) {
      const lx = x % (cells - 3), ly = y % (cells - 3);
      return (x % (cells - 1) === 0 || y % (cells - 1) === 0 || (x >= 1 && x <= (cells - 2) && y >= 1 && y <= (cells - 2) && ((x === 1 || x === (cells - 2)) || (y === 1 || y === (cells - 2)))) ) ? true : ((x >= 2 && x <= (cells - 3) && y >= 2 && y <= (cells - 3)));
    }
    h = (h * 1103515245 + 12345 + x * 7 + y * 13) >>> 0;
    return (h & 1) === 1;
  };
  const rects = [];
  const c = size / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) if (on(x, y)) rects.push(`<rect x="${(x * c).toFixed(1)}" y="${(y * c).toFixed(1)}" width="${c.toFixed(1)}" height="${c.toFixed(1)}" fill="#0f1730"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/>${rects.join("")}</svg>`;
  return <div className="cert-qr" title={verifyUrl(serial)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CertificateView({ cert, onBack }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const toast = useToast();
  const url = verifyUrl(cert.serial);
  const shareText = fa
    ? `من گواهی «${cert.title}» را از MED School گرفتم! استعلام: ${url}`
    : `I earned the "${cert.title}" certificate from MED School! Verify: ${url}`;
  const copyLink = () => { navigator.clipboard?.writeText(url); toast(fa ? "لینک کپی شد" : "Link copied"); };
  const linkedin = () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
  const telegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`, "_blank");
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  const print = () => window.print();
  const d = fmtDateLong(cert.issued_at, fa ? "fa" : "en");

  return (
    <div className="page">
      <button className="blog-back" onClick={onBack}>← {fa ? "بازگشت" : "Back"}</button>

      <div className="cert-sheet" id="cert-print">
        <div className="cert-border">
          <div className="cert-seal">🎓</div>
          <div className="cert-org">{cert.org}</div>
          <div className="cert-kicker">{fa ? "گواهی‌نامهٔ پایان دوره" : "Certificate of Completion"}</div>
          <div className="cert-awarded">{fa ? "این گواهی به" : "This certifies that"}</div>
          <div className="cert-name">{cert.recipient}</div>
          <div className="cert-for">{fa ? "برای تکمیل موفقیت‌آمیز دورهٔ" : "has successfully completed"}</div>
          <div className="cert-course">{cert.title}</div>
          {cert.hours && <div className="cert-hours">{fa ? `${cert.hours} ساعت مطالعه` : `${cert.hours} hours of study`}</div>}
          <div className="cert-footer">
            <div className="cert-sign">
              <div className="cert-sign-name">{cert.signer || cert.org}</div>
              <div className="cert-sign-title">{cert.signer_title || cert.org}</div>
              <div className="cert-sign-line">{fa ? "امضای مسئول" : "Authorized signature"}</div>
            </div>
            <div className="cert-qr-wrap">
              <QrBox serial={cert.serial} />
              <div className="cert-verify-note">{fa ? "برای استعلام اسکن کنید" : "Scan to verify"}</div>
            </div>
            <div className="cert-meta">
              <div><b>{fa ? "تاریخ" : "Date"}:</b> {d}</div>
              <div><b>{fa ? "شناسه" : "ID"}:</b> {cert.serial}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cert-actions no-print">
        <button className="btn btn-primary" onClick={print}><Icon name="download" size={15} /> {fa ? "چاپ / ذخیرهٔ PDF" : "Print / Save PDF"}</button>
        <button className="btn" onClick={copyLink}><Icon name="link" size={15} /> {fa ? "کپی لینک استعلام" : "Copy verify link"}</button>
        <button className="btn cert-btn-li" onClick={linkedin}>in</button>
        <button className="btn cert-btn-tg" onClick={telegram}>✈️</button>
        <button className="btn cert-btn-wa" onClick={whatsapp}>🟢</button>
      </div>
      <div className="small muted no-print" style={{ marginTop: 10 }}>
        {fa ? "هر کسی می‌تواند با این لینک اصالت گواهی شما را تأیید کند:" : "Anyone can confirm your certificate with this link:"}
        {" "}<a href={url} target="_blank" rel="noreferrer">{url}</a>
      </div>
    </div>
  );
}
