import { useMemo, useState } from "react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Renders one instrument and collects its answers.

   The previous questionnaire UI was a stub: it showed the form title and a
   single "ثبت" button that posted `{ ok: 1 }`, so nothing was actually
   measured. The study protocol's three instruments (Likert 1–5, Likert 0–10
   with an NPS item, and a 12-item binary checklist) need real scales, so this
   renders whatever the form's items describe rather than a fixed layout. */
export default function QuestionnaireForm({ form, lang, contextType, contextId, onDone, onCancel, compact }) {
  const fa = lang === "fa";
  const items = form.questions || [];
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const requiredIds = useMemo(() => items.filter((q) => q.required !== false).map((q) => q.id), [items]);
  const missing = requiredIds.filter((id) => answers[id] == null || answers[id] === "");

  const set = (id, v) => setAnswers((s) => ({ ...s, [id]: v }));

  const submit = async () => {
    if (missing.length) {
      setErr(fa ? `${missing.length} پرسش پاسخ داده نشده است.` : `${missing.length} question(s) are still unanswered.`);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/questionnaires/${form.id}/responses`, { answers, contextType, contextId });
      onDone?.();
    } catch (e) { setErr(e?.message || (fa ? "ثبت ناموفق بود." : "Could not submit.")); }
    finally { setBusy(false); }
  };

  const label = (q) => (fa ? (q.fa || q.en) : (q.en || q.fa)) || q.id;

  return (
    <div className={compact ? "" : "card"}>
      {!compact && (
        <>
          <h4>{fa ? (form.title_fa || form.title_en) : (form.title_en || form.title_fa)}</h4>
          {(form.description_fa || form.description_en) && (
            <div className="small muted mt4">{fa ? form.description_fa : form.description_en}</div>
          )}
          {!!form.anonymous && (
            <div className="small muted mt4">
              <Icon name="shield" size={13} /> {fa ? "پاسخ‌های شما بی‌نام ثبت می‌شود." : "Your answers are recorded anonymously."}
            </div>
          )}
        </>
      )}

      <div className="mt12">
        {items.map((q, idx) => {
          const type = q.type || "likert";

          /* Binary checklist item — one point when ticked (protocol Table 1). */
          if (type === "check") {
            return (
              <label key={q.id} className="toggle-row" style={{ padding: "6px 0" }}>
                <span className="small">{idx + 1}. {label(q)}</span>
                <input type="checkbox" checked={!!answers[q.id]} onChange={(e) => set(q.id, e.target.checked)} />
              </label>
            );
          }

          /* Likert scale — min..max, rendered as a row of radio buttons. */
          const min = Number(q.min ?? 1), max = Number(q.max ?? 5);
          const steps = [];
          for (let v = min; v <= max; v++) steps.push(v);
          return (
            <div key={q.id} className="field" style={{ marginTop: 10 }}>
              <div className="small">{idx + 1}. {label(q)}
                {q.nps && <span className="tag" style={{ marginInlineStart: 6 }}>NPS</span>}
              </div>
              <div className="row gap8 mt4" style={{ flexWrap: "wrap" }}>
                {steps.map((v) => (
                  <label key={v} className="btn btn-ghost btn-sm"
                         style={answers[q.id] === v ? { background: "var(--brand,#2563eb)", color: "#fff" } : {}}
                         onClick={() => set(q.id, v)}>
                    {v}
                  </label>
                ))}
              </div>
              <div className="small muted" style={{ fontSize: ".72rem" }}>
                {min}{fa ? " = کمترین" : " = lowest"} · {max}{fa ? " = بیشترین" : " = highest"}
              </div>
            </div>
          );
        })}
      </div>

      {err && <div className="err-banner mt12">{err}</div>}

      <div className="row gap8 mt12">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{fa ? "ثبت پاسخ‌ها" : "Submit"}</button>
        {onCancel && <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>{fa ? "بعداً" : "Later"}</button>}
      </div>
      {missing.length > 0 && (
        <div className="small muted mt4">{fa ? `${missing.length} پرسش باقی مانده` : `${missing.length} question(s) left`}</div>
      )}
    </div>
  );
}
