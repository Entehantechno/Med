import { useEffect, useState, useRef } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { Spinner } from "./UI.jsx";
import Confetti from "./Confetti.jsx";
import Icon from "./Icon.jsx";
import VirtualList from "./VirtualList.jsx";

/* Animated count-up number */
function CountUp({ value, duration = 900, delay = 0 }) {
  const [n, setN] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (value == null) { setN(null); return; }
    let started = false; let startTs = 0;
    const step = (ts) => {
      if (!started) { startTs = ts; started = true; }
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    const to = setTimeout(() => { raf.current = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(to); cancelAnimationFrame(raf.current); };
  }, [value, duration, delay]);
  return <>{n == null ? "—" : n}</>;
}

const LIVE_MS = 5000;

/* Competition leaderboard: animated podium (top 3) + ranked list below. */
export default function Leaderboard({ examId, meUserId, onClose }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [reveal, setReveal] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  /* Live ranking: re-fetch every LIVE_MS while the tab is visible. The API
     answers with an ETag (sendPrivateJson), so an unchanged board costs a
     304 with no body. A failed poll keeps the last good board on screen. */
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let timer = null;
    const load = () => {
      if (!alive || inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight = true;
      api.get(`/exams/${examId}/leaderboard`, { revalidate: true, timeoutMs: 15000 })
        .then((d) => {
          if (!alive) return;
          if (d) setData(d);
          setErr("");
          setUpdatedAt(Date.now());
          setReveal(true);
        })
        .catch((e) => { if (alive) setErr(String(e.message || e)); })
        .finally(() => { inFlight = false; });
    };
    const schedule = () => { clearInterval(timer); timer = setInterval(load, LIVE_MS); };
    const onVis = () => { if (!document.hidden) load(); };
    load();
    schedule();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [examId]);

  const name = (r) => (lang === "fa" ? r.name_fa : r.name_en) || r.student_no || "—";

  if (!data) return err ? <div className="err-banner">{err}</div> : <Spinner />;

  const ranked = data.ranked || [];
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // 2 · 1 · 3
  const heights = { 1: 150, 2: 112, 3: 88 };
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const winnerHasScore = top3[0] && top3[0].score != null;

  return (
    <div className={`lb ${reveal ? "reveal" : ""}`}>
      {reveal && winnerHasScore && <Confetti />}
      <div className="lb-head">
        <h3><Icon name="trophy" size={16} /> {lang === "fa" ? data.exam.title_fa : data.exam.title_en}</h3>
        {onClose && <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t("close")}</button>}
      </div>
      <div className="small muted" role="status" aria-live="polite" style={{ margin: "-4px 0 10px" }}>
        {err
          ? (lang === "fa" ? "اتصال برای به‌روزرسانی قطع شد؛ نمایش آخرین رتبه‌بندی." : "Update failed; showing the last ranking.")
          : (lang === "fa" ? `زنده · هر ${LIVE_MS / 1000} ثانیه به‌روز می‌شود` : `Live · refreshes every ${LIVE_MS / 1000}s`)}
        {updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
      </div>

      {ranked.length === 0 ? (
        <div className="small muted center" style={{ padding: 30 }}>{t("noData")}</div>
      ) : (<>
        {/* Podium */}
        <div className="podium">
          {podiumOrder.map((r, i) => (
            <div key={r.user_id} className={`podium-col rank-${r.rank} ${r.user_id === meUserId ? "me" : ""}`}
              style={{ "--d": `${i * 0.12 + 0.15}s` }}>
              <div className="podium-avatar">
                <span className="podium-ava-letter">{name(r).charAt(0)}</span>
                <span className="podium-medal">{medals[r.rank]}</span>
                {r.rank === 1 && <span className="podium-crown">👑</span>}
              </div>
              <div className="podium-name" title={name(r)}>{name(r)}</div>
              <div className="podium-score"><CountUp value={r.score} delay={i * 120 + 500} /></div>
              <div className="podium-bar" style={{ "--h": `${heights[r.rank]}px` }}>
                {r.rank === 1 && <span className="podium-shine" />}
                <span className="podium-rank">{r.rank}</span>
              </div>
            </div>
          ))}
        </div>

        {/* The rest, ranked — windowed so a 5 000-row leaderboard mounts only
            the ~20 visible rows instead of the whole table */}
        {rest.length > 0 && (
          <VirtualList
            className="lb-list"
            itemCount={rest.length}
            itemHeight={53}
            overscan={10}
            maxHeight={480}
          >
            {({ index, style }) => {
              const r = rest[index];
              return (
                <div key={r.user_id} className={`lb-row ${r.user_id === meUserId ? "me" : ""}`}
                  style={{ ...style, height: 44, marginBottom: 9, "--d": `${0.5 + Math.min(index, 12) * 0.05}s` }}>
                  <span className="lb-rank">{r.rank}</span>
                  <span className="lb-ava">{name(r).charAt(0)}</span>
                  <span className="lb-name">{name(r)}</span>
                  {r.student_no && <span className="lb-no">{r.student_no}</span>}
                  <span className="lb-score">{r.score == null ? "—" : r.score}</span>
                </div>
              );
            }}
          </VirtualList>
        )}
      </>)}
    </div>
  );
}
