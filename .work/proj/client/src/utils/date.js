/* Jalali (Shamsi) date formatting in Iran timezone (Asia/Tehran).
   Uses the built-in Intl API with the Persian calendar — no dependencies.
   ALL user-facing dates/times across the app go through these helpers so the
   whole product shows Shamsi dates and Tehran (Iran) local time consistently. */

const TZ = "Asia/Tehran";

function toDate(v) {
  if (!v) return null;
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC (no TZ marker).
  // Normalize to a proper UTC ISO string so it converts correctly to Tehran.
  let s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});
const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
const faDateLong = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TZ, year: "numeric", month: "long", day: "numeric",
});
const enDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});
const enDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
const enDateLong = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "long", day: "numeric",
});

export function fmtDate(v, lang = "fa") {
  const d = toDate(v); if (!d) return "—";
  return (lang === "fa" ? faDate : enDate).format(d);
}
export function fmtDateTime(v, lang = "fa") {
  const d = toDate(v); if (!d) return "—";
  return (lang === "fa" ? faDateTime : enDateTime).format(d);
}
/* Long, human date e.g. "۲۴ تیر ۱۴۰۵" / "15 July 2026" — for certificates, blog. */
export function fmtDateLong(v, lang = "fa") {
  const d = toDate(v); if (!d) return "—";
  return (lang === "fa" ? faDateLong : enDateLong).format(d);
}
/* Format seconds as m:ss */
export function fmtDuration(sec) {
  sec = +sec || 0;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---- <input type="datetime-local"> helpers, anchored to Tehran time ----
   The native picker interprets its value string as the BROWSER's local time.
   To keep scheduling correct for everyone (an admin abroad still schedules in
   Iran time), we read/write the picker value as Tehran wall-clock time and
   convert to/from a true UTC ISO string for storage. */

// Return the Tehran wall-clock parts for a given Date (via Intl, so DST-safe).
function tehranParts(date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  // "24" hour edge → normalize to "00"
  if (p.hour === "24") p.hour = "00";
  return p;
}

// Tehran's UTC offset (in minutes) at a given instant. Iran uses +03:30 (no DST since 2022).
function tehranOffsetMinutes(date) {
  const p = tehranParts(date);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// ISO/UTC string  ->  "YYYY-MM-DDTHH:MM" showing Tehran wall-clock (for the picker).
export function isoToTehranInput(iso) {
  const d = toDate(iso); if (!d) return "";
  const p = tehranParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Picker value "YYYY-MM-DDTHH:MM" (Tehran wall-clock)  ->  true UTC ISO string.
export function tehranInputToIso(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi] = m.map(Number);
  // Interpret the entered wall-clock as UTC first, then subtract Tehran's offset.
  const guessUTC = Date.UTC(Y, Mo - 1, D, H, Mi, 0);
  const off = tehranOffsetMinutes(new Date(guessUTC));
  return new Date(guessUTC - off * 60000).toISOString();
}

// A friendly Shamsi preview for whatever is currently in the picker (or ISO).
// Accepts either a picker value or an ISO string.
export function tehranInputPreview(v, lang = "fa") {
  if (!v) return "";
  // picker value has no timezone → treat its wall-clock as Tehran directly
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !/[Zz]|[+\-]\d{2}:\d{2}$/.test(v)
    ? tehranInputToIso(v) : v;
  return fmtDateTime(iso, lang);
}

/* ---- Jalali (Shamsi) calendar conversion (no dependency) --------------------
   Standard algorithm (Birashk-family, matches Intl's Persian calendar). Used by
   the exam scheduler so teachers pick a Shamsi date directly — no Gregorian
   picker anywhere. */
function div(a, b) { return Math.floor(a / b); }

// Gregorian (y,m,d) -> Jalali [jy, jm, jd]   (m,d are 1-based)
export function toJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

// Jalali [jy,jm,jd] -> Gregorian [gy, gm, gd]
export function toGregorian(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * div(--days, 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

// number of days in a Jalali month (for building day dropdowns)
export function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 29, or 30 in a leap year
  const [, , ] = [jy, jm, 1];
  // leap check via round-trip: is 1/1 of next year - Esfand 30 valid?
  const g = toGregorian(jy, 12, 30);
  const back = toJalali(g[0], g[1], g[2]);
  return back[1] === 12 && back[2] === 30 ? 30 : 29;
}

// Today's Jalali date in Tehran, as [jy,jm,jd].
export function todayJalali() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return toJalali(+p.year, +p.month, +p.day);
}

// Build a UTC ISO string from a Shamsi date + Tehran wall-clock time.
//   ({jy,jm,jd}, "HH:MM") -> ISO
export function jalaliTimeToIso(jy, jm, jd, hhmm) {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  const [H, Mi] = (hhmm || "00:00").split(":").map(Number);
  const guessUTC = Date.UTC(gy, gm - 1, gd, H || 0, Mi || 0, 0);
  const off = tehranOffsetMinutes(new Date(guessUTC));
  return new Date(guessUTC - off * 60000).toISOString();
}

// Parse a UTC ISO string into Tehran { jy,jm,jd, time:"HH:MM" }.
export function isoToJalaliParts(iso) {
  const d = toDate(iso); if (!d) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  const [jy, jm, jd] = toJalali(+p.year, +p.month, +p.day);
  let hh = p.hour === "24" ? "00" : p.hour;
  return { jy, jm, jd, time: `${hh}:${p.minute}` };
}
