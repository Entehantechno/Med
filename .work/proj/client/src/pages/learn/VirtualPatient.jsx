import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Pill, StarRating } from "../../components/UI.jsx";
import Exam from "../Exam.jsx";

/* VirtualPatient — the competitive-side virtual patient hub.
   Gated by the admin config (feature flag + enabled + optional premium-only).
   Lists playable cases and, on selecting one, hands off to the shared <Exam>
   play component (chat + orders + evaluation). Also surfaces the "case of the
   day" for a small gem reward when daily integration is on. AI is opt-in
   server-side; without a key the deterministic patient engine is used. */
export default function VirtualPatient({ onProfile, onBack, initialCaseId = null }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [data, setData] = useState(null);
  const [caseId, setCaseId] = useState(initialCaseId);

  const load = () => api.get(`/learn/vpatient?lang=${lang}`, { timeoutMs: 20_000, stage: "boot" }).then(setData).catch((e) => {
    const st = e?.status;
    const reason = !st || st >= 500 || st === 401 ? "network" : "off";
    setData({ enabled: false, access: false, reason, error: true, status: st || 0 });
  });
  useEffect(() => { load(); }, [lang]);

  // When a case is open, render the shared Exam play UI inside the learner shell.
  if (caseId) {
    return (
      <div className="page vp-play">
        <Exam
          caseId={caseId}
          embedded
          go={(view) => { if (view === "caseList" || view === "home") setCaseId(null); }}
          home={() => { setCaseId(null); load(); onProfile && api.get("/learn/profile").then(onProfile).catch(() => {}); }}
        />
      </div>
    );
  }

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;

  // Network / boot failure is NOT "feature off" — the learner must see the step.
  if (data.reason === "network") {
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="patient" size={22} /> {t("vpTitle")}</h2></div>
        <div className="card center" style={{ padding: 40 }}>
          <div style={{ fontSize: 44 }}><Icon name="warn" size={34} /></div>
          <h3 className="mt8">{fa ? "«بارگذاری فهرست بیماران» قطع شد" : "[Loading case list] failed"}</h3>
          <div className="muted small mt8">{fa ? "اتصال برقرار نشد. دوباره تلاش کنید." : "Could not reach the server. Please try again."}</div>
          <button className="btn btn-primary mt16" onClick={load}>{fa ? "تلاش دوباره" : "Try again"}</button>
        </div>
      </div>
    );
  }

  // Not available at all (flag off or admin disabled)
  if (!data.enabled) {
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="patient" size={22} /> {t("vpTitle")}</h2></div>
        <div className="card center" style={{ padding: 40 }}>
          <div style={{ fontSize: 44 }}><Icon name="lock" size={34} /></div>
          <h3 className="mt8">{fa ? "بیمار مجازی هنوز فعال نیست" : "Virtual patient isn't active yet"}</h3>
          <div className="muted small mt8">{fa ? "این قابلیت به‌زودی در دسترس قرار می‌گیرد." : "This feature will be available soon."}</div>
        </div>
      </div>
    );
  }

  // Available, but this learner needs premium
  if (!data.access && data.reason === "premium") {
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="patient" size={22} /> {t("vpTitle")}</h2></div>
        <div className="card center vp-locked" style={{ padding: 36 }}>
          <div style={{ fontSize: 44, color: "var(--gold)" }}><Icon name="crown" size={38} /></div>
          <h3 className="mt8">{fa ? "ویژهٔ کاربران پریمیوم" : "Premium feature"}</h3>
          <div className="muted mt8" style={{ maxWidth: 420, margin: "8px auto 0" }}>
            {fa ? "بیمار مجازی — گفت‌وگوی بالینی، درخواست آزمایش و تصویربرداری، و ارزیابیِ عملکردت — ویژهٔ اعضای پریمیوم است."
                : "Virtual patient — clinical dialogue, ordering labs & imaging, and performance evaluation — is a premium member benefit."}
          </div>
        </div>
      </div>
    );
  }

  const cases = data.cases || [];
  const dailyId = data.in_daily ? data.daily_case_id : null;
  const dailyCase = dailyId ? cases.find((c) => c.id === dailyId) : null;

  return (
    <div className="page">
      <div className="section-title">
        <h2><Icon name="patient" size={22} /> {t("vpTitle")}</h2>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button>}
      </div>
      <p className="muted mb16" style={{ maxWidth: 620 }}>
        {fa ? "یک بیمار را انتخاب کن، شرح‌حال بگیر، آزمایش و تصویربرداری درخواست کن، تشخیص بده و در پایان ارزیابی بگیر."
            : "Pick a patient, take a history, order labs & imaging, reach a diagnosis, and get evaluated at the end."}
      </p>

      {/* Case of the day (daily challenge integration) */}
      {dailyCase && (
        <div className="card vp-daily" style={{ borderInlineStart: "4px solid var(--gold)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 30 }}><Icon name="target" size={26} /></div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 800 }}>{fa ? "بیمارِ امروز" : "Case of the day"}</div>
              <div className="small muted">{dailyCase.title || dailyCase.chief} · {dailyCase.specialty}</div>
              {data.daily_gems > 0 && <div className="small" style={{ color: "var(--gold)", marginTop: 2 }}>+{data.daily_gems} {t("gems")}</div>}
            </div>
            <button className="btn btn-primary" onClick={() => setCaseId(dailyCase.id)}>{fa ? "شروع بیمار امروز" : "Start today's case"}</button>
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="card center" style={{ padding: 36 }}>
          <div style={{ fontSize: 40 }}><Icon name="patient" size={30} /></div>
          <div className="muted mt8">{fa ? "هنوز بیماری اضافه نشده است." : "No cases added yet."}</div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {cases.map((c) => (
            <div className="case-item vp-case" key={c.id}>
              <div>
                <strong>{c.title || c.chief}</strong>
                <StarRating score={c.best} lang={lang} />
                <div className="case-meta">
                  <Pill kind={c.difficulty}>{t(c.difficulty)}</Pill>
                  {c.specialty && <span className="tag">{c.specialty}</span>}
                  {c.age != null && <span className="tag">{t("age")}: {c.age}</span>}
                  {c.sex && <span className="tag">{t(c.sex)}</span>}
                </div>
                {c.title && c.chief && <div className="small muted mt8">{t("chief")}: {c.chief}</div>}
              </div>
              <button className="btn btn-primary" onClick={() => setCaseId(c.id)}>{fa ? "شروع" : "Start"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
