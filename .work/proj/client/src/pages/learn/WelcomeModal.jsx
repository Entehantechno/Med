import { useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { useScrollLock } from "../../utils/useScrollLock.js";

/* First-time welcome flow (shown once). Research (Duolingo pattern):
   "goal & motivation first" — a short, skippable, 3-step flow that greets the
   learner, asks WHY they're here (commitment), and sets a daily goal. This
   primes retention. Saved server-side (welcome_seen) so it never repeats. */
const GOALS = [
  { value: 10, emoji: "🌱", fa: "آسان — ۵ دقیقه", en: "Casual — 5 min" },
  { value: 20, emoji: "🙂", fa: "معمولی — ۱۰ دقیقه", en: "Regular — 10 min" },
  { value: 30, emoji: "💪", fa: "جدی — ۱۵ دقیقه", en: "Serious — 15 min" },
  { value: 50, emoji: "🔥", fa: "شدید — ۳۰ دقیقه", en: "Intense — 30 min" },
];

export default function WelcomeModal({ user, onDone }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [step, setStep] = useState(0);
  const [why, setWhy] = useState("");
  const [goal, setGoal] = useState(30);
  const [busy, setBusy] = useState(false);
  const name = (fa ? user?.name_fa : user?.name_en) || user?.name_fa || "";

  const reasons = [
    { id: "exam", emoji: "🎓", fa: "قبولی در آزمون", en: "Pass my exam" },
    { id: "habit", emoji: "📅", fa: "عادت مطالعهٔ روزانه", en: "Build a daily habit" },
    { id: "compete", emoji: "🏆", fa: "رقابت و سرگرمی", en: "Compete & have fun" },
    { id: "review", emoji: "🔁", fa: "مرور و تثبیت", en: "Review & retain" },
  ];

  const finish = async () => {
    setBusy(true);
    try {
      await api.post("/learn/daily/goal", { value: goal }).catch(() => {});
      await api.post("/learn/welcome/seen", {}).catch(() => {});
    } finally { setBusy(false); onDone?.(); }
  };
  const skip = async () => { await api.post("/learn/welcome/seen", {}).catch(() => {}); onDone?.(); };
  useScrollLock(true);

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <button className="welcome-skip" onClick={skip}>{fa ? "رد کردن" : "Skip"}</button>
        {/* progress dots */}
        <div className="welcome-dots">
          {[0, 1, 2].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}
        </div>

        {step === 0 && (
          <div className="welcome-step">
            <div className="welcome-emoji">👋</div>
            <h2>{fa ? `${name} عزیز، خوش آمدی!` : `Welcome, ${name}!`}</h2>
            <p>{fa
              ? "MED School یادگیری پزشکی را به یک برنامهٔ منظم روزانه تبدیل می‌کند: درس‌های کوتاه و هدفمند، مرور فاصله‌دار، رتبه‌بندی کشوری و چالش روز. بیا در چند ثانیه شروع کنیم."
              : "MED School turns medical study into a disciplined daily routine: short focused lessons, spaced repetition, a national ranking and a daily challenge. Let's set you up in a few seconds."}</p>
            <button className="btn btn-primary btn-block btn-lg" onClick={() => setStep(1)}>
              {fa ? "شروع کنیم" : "Let's go"} <Icon name={fa ? "chevronLeft" : "chevronRight"} size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="welcome-step">
            <div className="welcome-emoji">🎯</div>
            <h2>{fa ? "چرا اینجایی؟" : "Why are you here?"}</h2>
            <p className="small muted">{fa ? "کمک می‌کند تجربه را برایت شخصی‌تر کنیم." : "This helps us personalize your experience."}</p>
            <div className="welcome-choices">
              {reasons.map((r) => (
                <button key={r.id} className={`welcome-choice ${why === r.id ? "sel" : ""}`} onClick={() => setWhy(r.id)}>
                  <span className="wc-emoji">{r.emoji}</span> {fa ? r.fa : r.en}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={!why} onClick={() => setStep(2)}>
              {fa ? "بعدی" : "Next"} <Icon name={fa ? "chevronLeft" : "chevronRight"} size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="welcome-step">
            <div className="welcome-emoji">📅</div>
            <h2>{fa ? "هدف روزانه‌ات چقدر باشد؟" : "Pick your daily goal"}</h2>
            <p className="small muted">{fa ? "هر روز به این هدف برس تا استریکت زنده بماند. بعداً قابل تغییر است." : "Hit it daily to keep your streak alive. You can change it later."}</p>
            <div className="welcome-choices">
              {GOALS.map((g) => (
                <button key={g.value} className={`welcome-choice ${goal === g.value ? "sel" : ""}`} onClick={() => setGoal(g.value)}>
                  <span className="wc-emoji">{g.emoji}</span> {fa ? g.fa : g.en} <span className="wc-xp">{g.value} XP</span>
                </button>
              ))}
            </div>
            <button className="btn btn-accent btn-block btn-lg" disabled={busy} onClick={finish}>
              🚀 {fa ? "بزن بریم!" : "Start learning!"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
