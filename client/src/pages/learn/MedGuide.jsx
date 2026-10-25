import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";

/* ---------------------------------------------------------------------------
   MedGuide — "دکتر مِد", the platform's friendly MEDICAL guide/mascot.
   It reads the learner's live difficulty calibration (Challenge Point
   Framework) and speaks a short, zone-aware, encouraging message so the learner
   always knows whether they're in their optimal challenge zone. AI-free: every
   line is a deterministic, hand-written medical-education message. The mascot is
   an inline SVG (a smiling stethoscope) so it renders even in offline previews.
--------------------------------------------------------------------------- */

// Pick a stable-ish line per zone (varies by day so it doesn't feel robotic).
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const MSG = {
  fa: {
    warmup: {
      face: "🙂",
      lines: [
        "سلام! من دکتر مِد هستم، همراهِ یادگیری‌ات. بریم چند کارت پزشکی مرور کنیم!",
        "آماده‌ای؟ اول چند سؤال گرم‌کردنی، بعد می‌رویم سراغ چالش‌های واقعی.",
      ],
    },
    in: {
      face: "😃",
      title: "دقیقاً در منطقهٔ یادگیری",
      lines: [
        "عالی پیش می‌روی! این سطحِ چالش دقیقاً همان‌جایی است که مغز بیشترین یادگیری را دارد.",
        "تعادلِ فوق‌العاده‌ای بین سختی و موفقیت داری — همین‌طور ادامه بده!",
        "این «نقطهٔ چالش بهینه» است: نه خیلی آسان، نه طاقت‌فرسا. ماندگاری‌ات همین‌جا ساخته می‌شود.",
      ],
    },
    easy: {
      face: "😎",
      title: "کمی زیادی آسان شده",
      lines: [
        "داری خیلی راحت جواب می‌دهی! بیا سطح را کمی سخت‌تر کنم تا واقعاً رشد کنی.",
        "این‌ها برایت آب‌خوردن شده — سراغ کارت‌های چالشی‌تر و آزمون Checkpoint برویم.",
      ],
    },
    hard: {
      face: "🤗",
      title: "کمی سخت شده — اشکالی ندارد",
      lines: [
        "چند تا سؤال سخت بود، نگران نباش. کمی درس‌های سبک‌تر و مرور بزنیم تا دوباره اوج بگیری.",
        "خطا بخشی از یادگیری پزشکی است. یک نفس بکش؛ با مرورِ هدفمند سریع جبران می‌شود.",
      ],
    },
    unknown: {
      face: "🙂",
      title: "بیا با هم شروع کنیم",
      lines: [
        "هنوز کافی جواب نداده‌ای تا سطحت را بسنجم. چند درس بزن تا مسیرت را دقیق تنظیم کنم!",
      ],
    },
  },
  en: {
    warmup: { face: "🙂", lines: ["Hi! I'm Dr. Med, your study buddy. Let's review some medical cards!"] },
    in: {
      face: "😃", title: "Right in your learning zone",
      lines: [
        "You're nailing it! This challenge level is exactly where your brain learns most.",
        "Great balance of difficulty and success — keep going!",
      ],
    },
    easy: {
      face: "😎", title: "A little too easy",
      lines: ["You're breezing through — let me raise the difficulty so you really grow."],
    },
    hard: {
      face: "🤗", title: "A bit hard — that's okay",
      lines: ["A few tough ones there. Let's do lighter review to rebuild momentum. Mistakes are part of learning medicine."],
    },
    unknown: {
      face: "🙂", title: "Let's get started",
      lines: ["Not enough answers yet to gauge your level. Do a few lessons so I can tune your path!"],
    },
  },
};

/* The stethoscope mascot as a self-contained SVG (renders offline). */
function MascotSvg({ face = "🙂", zone = "in" }) {
  const accent = zone === "hard" ? "#e0912e" : zone === "easy" ? "#6d5bd0" : "#22a06b";
  return (
    <div className="medguide-ava" style={{ "--mg-accent": accent }} aria-hidden="true">
      <svg viewBox="0 0 96 96" width="72" height="72" role="img">
        {/* stethoscope tubing */}
        <path d="M30 20 C24 34, 24 50, 34 58" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        <path d="M66 20 C72 34, 72 50, 62 58" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        <circle cx="30" cy="18" r="5" fill={accent} />
        <circle cx="66" cy="18" r="5" fill={accent} />
        {/* chestpiece = the smiling face */}
        <circle cx="48" cy="66" r="22" fill="#fff" stroke={accent} strokeWidth="5" />
        <circle cx="48" cy="66" r="14" fill="#eef4fb" />
      </svg>
      <span className="medguide-face">{face}</span>
    </div>
  );
}

export default function MedGuide({ compact = false }) {
  const { lang } = useApp();
  const [snap, setSnap] = useState(null);
  const [line, setLine] = useState("");

  useEffect(() => {
    let alive = true;
    api.get(`/learn/calibration`).then((d) => {
      if (!alive) return;
      setSnap(d);
      const L = MSG[lang === "en" ? "en" : "fa"];
      const zone = d?.enabled === false ? "unknown" : (d?.calibrated ? (d.zone || "in") : "unknown");
      setLine(pick((L[zone] || L.unknown).lines));
    }).catch(() => setSnap({ enabled: false }));
    return () => { alive = false; };
  }, [lang]);

  if (!snap || snap.enabled === false) return null;
  const L = MSG[lang === "en" ? "en" : "fa"];
  const zone = snap.calibrated ? (snap.zone || "in") : "unknown";
  const z = L[zone] || L.unknown;

  return (
    <div className={`card medguide medguide-${zone} ${compact ? "compact" : ""}`}>
      <MascotSvg face={z.face} zone={zone} />
      <div className="medguide-body">
        <div className="medguide-name">
          {lang === "fa" ? "دکتر مِد" : "Dr. Med"}
          {z.title && <span className={`medguide-zone zone-${zone}`}>{z.title}</span>}
        </div>
        <div className="medguide-line">{line}</div>
        {snap.calibrated && (
          <div className="medguide-meter" title={lang === "fa" ? "تخمین سطح مهارت تو" : "Your estimated skill"}>
            <div className="mg-track">
              <span style={{ width: `${snap.ability}%` }} />
              {/* the target challenge zone band */}
              <i className="mg-zone-band" style={{
                insetInlineStart: `${snap.targetSuccess - 12}%`, width: "24%",
              }} />
            </div>
            <div className="mg-meter-label small muted">
              {lang === "fa" ? "سطح مهارت" : "Skill"}: <b>{snap.ability}٪</b>
              {snap.recentAccuracy != null && <> · {lang === "fa" ? "دقت اخیر" : "recent"}: {snap.recentAccuracy}٪</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* A tiny in-lesson calibration chip (used by Lesson.jsx to reassure the learner
   that the deck was tuned to their level). */
export function CalibrationChip({ calibration }) {
  const { lang } = useApp();
  if (!calibration || !calibration.calibrated) return null;
  return (
    <span className="calib-chip" title={lang === "fa"
      ? `این درس متناسب با سطح تو مرتب شده — ${calibration.inZone} از ${calibration.total} سؤال در منطقهٔ چالش بهینه`
      : `Tuned to your level — ${calibration.inZone}/${calibration.total} questions in your challenge zone`}>
      🎯 {lang === "fa" ? "متناسب با سطح تو" : "Tuned to you"}
    </span>
  );
}
