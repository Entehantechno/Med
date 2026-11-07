/* ================================================================
   tehran-time.js — the calendar as Iran sees it (Asia/Tehran).

   One place for "which day/month/hour is it in Tehran". Each Intl formatter is
   built once: building one per call cost tens of microseconds and several of
   them ran on every learner request.
   ================================================================ */
const TZ = "Asia/Tehran";
const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const MONTH_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
// h23 (not hour12:false) so midnight is 0, never 24.
const HOUR_FMT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });

/** YYYY-MM-DD in Tehran. */
export function tehranDay(d = new Date()) { return DAY_FMT.format(new Date(d)); }
/** YYYY-MM in Tehran. */
export function tehranMonth(d = new Date()) { return MONTH_FMT.format(new Date(d)); }
/** Hour 0–23 in Tehran. */
export function tehranHour(d = new Date()) { return Number(HOUR_FMT.format(new Date(d))) % 24; }
