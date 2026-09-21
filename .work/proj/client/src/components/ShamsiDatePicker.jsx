import { useApp } from "../context.jsx";
import { todayJalali, jalaliMonthDays, toGregorian, isoToJalaliParts } from "../utils/date.js";

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];

/* Shamsi (Jalali) date picker — three selects (year / month / day). Fully
   Persian-calendar; NO native Gregorian widget. Two ways to use it:
     • Controlled parts:  <ShamsiDatePicker jy jm jd onChange={({jy,jm,jd})=>…} />
     • ISO value (YYYY-MM-DD):  <ShamsiDatePicker value={iso} onChangeIso={(iso)=>…} />
   The ISO mode is handy for learner-facing inputs that store a plain date. */
export default function ShamsiDatePicker({ jy, jm, jd, onChange, value, onChangeIso, allowEmpty = false }) {
  const { lang } = useApp();
  const months = lang === "fa" ? MONTHS_FA : MONTHS_EN;

  // ISO mode: derive current parts from the ISO string (or today's date).
  const isoMode = onChangeIso !== undefined;
  let curY = jy, curM = jm, curD = jd, empty = false;
  if (isoMode) {
    if (value) {
      // accept "YYYY-MM-DD" or a full ISO; normalise to midday to avoid TZ slips
      const p = isoToJalaliParts(/T/.test(value) ? value : `${value}T12:00:00`);
      if (p) { curY = p.jy; curM = p.jm; curD = p.jd; }
      else { const [ty, tm, td] = todayJalali(); curY = ty; curM = tm; curD = td; empty = allowEmpty; }
    } else {
      const [ty, tm, td] = todayJalali();
      curY = ty; curM = tm; curD = td; empty = allowEmpty;
    }
  }

  const [cy] = todayJalali();
  const years = []; for (let y = cy; y <= cy + 3; y++) years.push(y); // this year + next 3
  const maxDay = jalaliMonthDays(curY, curM);
  const days = []; for (let d = 1; d <= maxDay; d++) days.push(d);
  const num = (n) => lang === "fa" ? n.toLocaleString("fa-IR", { useGrouping: false }) : n;

  const emit = (patch) => {
    const next = { jy: curY, jm: curM, jd: curD, ...patch };
    const mx = jalaliMonthDays(next.jy, next.jm);
    if (next.jd > mx) next.jd = mx; // clamp day when month/year changes
    if (isoMode) {
      const [gy, gm, gd] = toGregorian(next.jy, next.jm, next.jd);
      const iso = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
      onChangeIso(iso);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="grid grid-3">
      <div className="field"><label>{lang === "fa" ? "سال" : "Year"}</label>
        <select value={empty ? "" : curY} onChange={(e) => emit({ jy: +e.target.value })}>
          {empty && <option value="">—</option>}
          {years.map((y) => <option key={y} value={y}>{num(y)}</option>)}
        </select></div>
      <div className="field"><label>{lang === "fa" ? "ماه" : "Month"}</label>
        <select value={empty ? "" : curM} onChange={(e) => emit({ jm: +e.target.value })}>
          {empty && <option value="">—</option>}
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select></div>
      <div className="field"><label>{lang === "fa" ? "روز" : "Day"}</label>
        <select value={empty ? "" : curD} onChange={(e) => emit({ jd: +e.target.value })}>
          {empty && <option value="">—</option>}
          {days.map((d) => <option key={d} value={d}>{num(d)}</option>)}
        </select></div>
    </div>
  );
}
