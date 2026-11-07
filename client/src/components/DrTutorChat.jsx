import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";

/* Dr Tutor panel. R90: the reply is shown (it was dropped before), the sent
   message appears at once (optimistic) and is marked failed if the server
   refuses, and the answer's source (AI or guide) is labelled. */
/* R92: say why a message failed. Each cause gets its own text: "try again" is wrong for a
   disabled tutor, a per-account limit, or a context the student is not enrolled in. */
function tutorErrorText(err, fa) {
  const code = err?.data?.error || "";
  if (code === "ai_rate_limited") {
    return (fa ? err.data.message_fa : err.data.message_en) || (fa ? "کمی صبر کن و دوباره بپرس." : "Wait a moment and ask again.");
  }
  if (code === "tutor_disabled") return fa ? "دکتر راهنما فعلاً در دسترس نیست." : "Dr Tutor is not available right now.";
  if (code === "bad_context") return fa ? "این گفتگو پیدا نشد." : "This chat could not be found.";
  if (["not enrolled", "not assigned", "context_unavailable", "university_only", "forbidden"].includes(code)) {
    return fa ? "این گفتگو برای حساب تو در دسترس نیست." : "This chat is not available for your account.";
  }
  if (err?.status === 0 || code === "network" || code === "timeout") {
    return fa ? "اتصال برقرار نشد. دوباره تلاش کن." : "Connection failed. Please try again.";
  }
  return fa ? "ارسال نشد. دوباره تلاش کن." : "Not sent. Please try again.";
}

export default function DrTutorChat({ contextType = "general", contextId = null }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef(null);
  const q = `contextType=${contextType}&contextId=${contextId || ""}`;

  useEffect(() => {
    let alive = true;
    api.get(`/tutor/status?${q}`)
      .then((d) => { if (alive) setEnabled(!!d.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, [contextType, contextId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !enabled) return undefined;
    let alive = true;
    api.get(`/tutor/history?${q}`)
      .then((d) => {
        if (!alive) return;
        setItems((d.messages || []).map((m) => ({
          id: `h${m.created_at}-${m.role}-${m.message.length}`,
          role: m.role === "user" ? "user" : "tutor",
          text: m.message,
          status: "sent",
        })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, enabled, contextType, contextId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [items.length]);

  if (!enabled) return null;

  const send = async (e) => {
    e?.preventDefault?.();
    const message = text.trim();
    if (!message || busy) return;
    const id = `local-${Date.now()}`;
    // Optimistic: the learner sees their message at once, before the server reply.
    setItems((list) => [...list, { id, role: "user", text: message, status: "pending" }]);
    setText("");
    setBusy(true);
    setError("");
    try {
      const d = await api.post("/tutor/message", { message, contextType, contextId, lang: fa ? "fa" : "en" });
      setItems((list) => [
        ...list.map((m) => (m.id === id ? { ...m, status: "sent" } : m)),
        { id: `${id}-r`, role: "tutor", text: d.reply, source: d.source },
      ]);
    } catch (err) {
      setItems((list) => list.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      setText(message);
      setError(tutorErrorText(err, fa));
    } finally {
      setBusy(false);
    }
  };

  const label = fa ? "دکتر راهنما" : "Dr Tutor";
  return (
    <div className="dr-tutor">
      <button
        type="button"
        className="dr-tutor-fab"
        aria-expanded={open}
        aria-controls="dr-tutor-panel"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >🩺</button>
      {open && (
        <div id="dr-tutor-panel" className="dr-tutor-panel card" role="region" aria-label={label}>
          <b>{label}</b>
          <div className="dr-tutor-log" ref={logRef} role="log" aria-live="polite">
            {items.length === 0 && (
              <p className="muted small">{fa ? "سؤالت را بپرس؛ به جای پاسخ نهایی، کمک می‌کنم به جواب برسی." : "Ask your question. I will guide you to the answer."}</p>
            )}
            {items.map((m) => (
              <div key={m.id} className={`dr-tutor-msg dr-tutor-${m.role}`}>
                <div>{m.text}</div>
                {m.role === "tutor" && m.source && (
                  <small className="muted">{m.source === "ai" ? (fa ? "هوش مصنوعی" : "AI") : (fa ? "راهنمای خودکار" : "Guide")}</small>
                )}
                {m.status === "pending" && <small className="muted">{fa ? "در حال ارسال…" : "Sending…"}</small>}
                {m.status === "failed" && <small style={{ color: "#b91c1c" }}>{fa ? "ارسال نشد" : "Failed"}</small>}
              </div>
            ))}
          </div>
          {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
          <form className="dr-tutor-input" onSubmit={send}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={fa ? "پیام به دکتر راهنما" : "Message to Dr Tutor"}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
              {fa ? "ارسال" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
