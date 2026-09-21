import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import { GemIcon } from "../../components/StatIcons.jsx";
import SearchAnswer from "../../components/SearchAnswer.jsx";
import { playFanfare } from "../../lib/feedback.js";
import { fmtDate } from "../../utils/date.js";

/* Daily Diagnosis Challenge — an original Wordle-style clinical-reasoning game.
   Read the vignette, pick a diagnosis; each wrong guess reveals the next clue.
   Fewer guesses = better. Solving keeps your streak alive. */
export default function DailyChallenge({ onProfile }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const load = () => api.get("/learn/dx/daily").then(setD).catch(() => setD({ available: false }));
  useEffect(() => { load(); }, [lang]);

  const share = (channel) => {
    // record the share for the "share-to-earn" reward + admin analytics
    api.post("/learn/social/share", { kind: "dx", channel }).then((r) => { if (r?.rewardGems) onProfile?.(); }).catch(() => {});
  };

  const guess = async (text) => {
    if (busy || d?.finished) return;
    setBusy(true);
    try {
      const view = await api.post("/learn/dx/guess", { caseId: d.caseId, guess: text });
      // the guess response is a case view (no `available` field) — preserve the
      // availability flag so the main UI keeps rendering.
      setD({ available: true, ...view });
      if (view.solved) { playFanfare(); setCelebrate(true); setTimeout(() => setCelebrate(false), 2500); onProfile?.(); }
    } catch { /* */ } finally { setBusy(false); }
  };

  if (!d) return <div className="card"><div className="skeleton" style={{ height: 260 }} /></div>;
  if (d.available === false) {
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="target" size={22} /> {t("dxTitle")}</h2></div>
        <div className="card empty-state"><div className="ico"><Icon name="target" size={40} /></div>
          <h3>{fa ? "امروز چالشی موجود نیست" : "No challenge today"}</h3>
          <div className="small muted">{fa ? "به‌زودی کیس جدید اضافه می‌شود." : "New cases coming soon."}</div>
        </div>
      </div>
    );
  }

  const guessedTexts = new Set(d.guesses.map((g) => g.text));
  const shareGrid = buildShareGrid(d);

  return (
    <div className="page dx-page">
      {celebrate && <Confetti />}
      <div className="section-title">
        <h2><Icon name="target" size={22} /> {t("dxTitle")}</h2>
        <span className="dx-day small muted">{fmtDate(d.day, lang)}</span>
      </div>
      <div className="small muted mb16">{t("dxHowto")}</div>

      {/* case card */}
      <div className="card dx-case">
        <div className="dx-cat"><Icon name="patient" size={14} /> {d.category} · <span className="dx-diff">{t(d.difficulty)}</span></div>
        <div className="dx-vignette">{d.vignette}</div>

        {/* progressive clues */}
        {d.clues.length > 0 && (
          <ol className="dx-clues">
            {d.clues.map((c, i) => <li key={i} className="dx-clue"><Icon name="bulb" size={14} /> {c}</li>)}
          </ol>
        )}

        {/* guesses so far (Wordle-style row) */}
        {d.guesses.length > 0 && (
          <div className="dx-guesses">
            {d.guesses.map((g, i) => (
              <div key={i} className={`dx-guess ${g.correct ? "ok" : "no"}`}>
                <span>{g.correct ? "🟩" : "🟥"}</span> {g.text}
              </div>
            ))}
          </div>
        )}

        {/* guess counter */}
        {!d.finished && (
          <div className="dx-counter small muted">
            {fa ? "حدس باقی‌مانده:" : "Guesses left:"} <b>{d.guessesLeft}</b>
            {" · "}{fa ? "سرنخ‌ها:" : "Clues:"} {d.clues.length}/{d.totalClues}
          </div>
        )}
      </div>

      {/* answer options */}
      {!d.finished ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{fa ? "تشخیص شما چیست؟" : "What's your diagnosis?"}</div>
          {/* Smart search box (same as the university flashcards): type to filter
              the differential, then pick. Bilingual matching. */}
          {Array.isArray(d.optionsBi) && d.optionsBi.length ? (
            <SearchAnswer
              options={d.optionsBi}
              lang={lang}
              disabled={busy}
              clearOnPick
              placeholder={fa ? "تشخیص را تایپ و انتخاب کن…" : "Type your diagnosis…"}
              onPick={(i) => {
                const opt = d.optionsBi[i];
                const text = fa ? (opt.fa || opt.en) : (opt.en || opt.fa);
                if (text && !guessedTexts.has(text)) guess(text);
              }}
            />
          ) : (
            /* fallback to buttons if bilingual options aren't available */
            <div className="dx-options">
              {d.options.map((o) => (
                <button key={o} className="dx-opt" disabled={busy || guessedTexts.has(o)} onClick={() => guess(o)}>{o}</button>
              ))}
            </div>
          )}
          {/* already-guessed chips so the learner sees their tries */}
          {d.guesses.length > 0 && (
            <div className="dx-tries small muted" style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {d.guesses.map((g, i) => (
                <span key={i} className="tag" style={{ background: g.correct ? "rgba(34,160,107,.14)" : "rgba(224,84,79,.12)", color: g.correct ? "#178053" : "#c0392b" }}>
                  {g.correct ? "✓" : "✕"} {g.text}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={`card dx-result ${d.solved ? "won" : "lost"}`}>
          <div className="dx-result-head">
            {d.solved
              ? (d.guesses.length === 1
                  ? <><Icon name="circleCheck" size={22} /> {fa ? "عالی! همان حدس اول زدی 🎯" : "Brilliant! Nailed it first try 🎯"}</>
                  : d.guesses.length <= 2
                    ? <><Icon name="circleCheck" size={22} /> {fa ? `آفرین! فقط با ${d.guesses.length} حدس` : `Great! In just ${d.guesses.length} guesses`}</>
                    : <><Icon name="circleCheck" size={22} /> {fa ? `تشخیص دادی — در ${d.guesses.length} حدس` : `Solved — in ${d.guesses.length} guesses`}</>)
              : <><Icon name="close" size={22} /> {fa ? "این بار نشد — ولی خوب تلاش کردی 💪" : "Not this time — but nice effort 💪"}</>}
          </div>
          {d.awards && (
            <div className="dx-awards">
              +{d.awards.xp} XP{d.awards.gems ? <> · +{d.awards.gems} <GemIcon size={13} /></> : ""}
              {d.awards.firstTry ? ` · ${fa ? "حدس اول! 🎯" : "First try! 🎯"}` : ""}
              {d.awards.effort ? ` · ${fa ? "پاداش تلاش" : "effort reward"}` : ""}
            </div>
          )}
          <div className="dx-answer">{fa ? "تشخیص درست:" : "Correct diagnosis:"} <b>{d.answer}</b></div>
          {d.explanation && <div className="dx-explain">{d.explanation}</div>}
          <div className="dx-share">
            <div className="dx-share-grid">{shareGrid}</div>
            <div className="dx-share-btns">
              <button className="btn btn-ghost btn-sm" onClick={() => { copyShare(d, shareGrid, fa); share("copy"); }}>
                <Icon name="download" size={14} /> {fa ? "کپی نتیجه" : "Copy result"}
              </button>
              <button className="dx-sh tg" title="Telegram" onClick={() => { openShare("telegram", shareTextOf(d, shareGrid, fa)); share("telegram"); }}>✈️</button>
              <button className="dx-sh wa" title="WhatsApp" onClick={() => { openShare("whatsapp", shareTextOf(d, shareGrid, fa)); share("whatsapp"); }}>🟢</button>
              <button className="dx-sh ig" title="Instagram" onClick={() => { copyShare(d, shareGrid, fa); share("instagram"); }}>📸</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shareTextOf(d, grid, fa) {
  const title = fa ? "چالش تشخیص روز — MED School 🩺" : "MED School — Daily Diagnosis 🩺";
  const line = d.solved ? `${d.guesses.length}/${d.maxGuesses}` : "X/" + d.maxGuesses;
  const cta = fa ? "تو هم امتحان کن:" : "Try it:";
  return `${title}\n${line} ${grid}\n${cta} medschool.ir`;
}
function openShare(channel, text) {
  const enc = encodeURIComponent(text);
  const url = channel === "telegram"
    ? `https://t.me/share/url?url=${encodeURIComponent("https://medschool.ir")}&text=${enc}`
    : `https://wa.me/?text=${enc}`;
  try { window.open(url, "_blank", "noopener"); } catch { /* */ }
}

function buildShareGrid(d) {
  return d.guesses.map((g) => (g.correct ? "🟩" : "🟥")).join("");
}
function copyShare(d, grid, fa) {
  const title = fa ? "چالش تشخیص روز — MED School" : "MED School — Daily Diagnosis";
  const line = d.solved
    ? (fa ? `${d.guesses.length}/${d.maxGuesses} حدس` : `${d.guesses.length}/${d.maxGuesses}`)
    : (fa ? "حل نشد" : "X/" + d.maxGuesses);
  try { navigator.clipboard.writeText(`${title} ${fmtDate(d.day, fa ? "fa" : "en")}\n${line}\n${grid}`); } catch { /* */ }
}
