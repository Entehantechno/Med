import { useEffect, useRef, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Floating in-app support chat. Always-on bubble (bottom corner) that opens a
   polished chat panel. Users pick a category (question/bug/feedback/account),
   send messages, and the admin team replies — shown right here. A badge shows
   unread admin replies. Hidden for admins (they reply from the admin inbox). */

const CAT_META = {
  question: { emoji: "❓", fa: "پرسش", en: "Question" },
  bug: { emoji: "🐞", fa: "گزارش باگ", en: "Report a bug" },
  feedback: { emoji: "💡", fa: "نظر و پیشنهاد", en: "Feedback" },
  account: { emoji: "👤", fa: "حساب کاربری", en: "Account" },
};

export default function SupportWidget() {
  const { t, lang, user, flag } = useApp();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [unread, setUnread] = useState(0);
  const [category, setCategory] = useState("question");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [view, setView] = useState("chat");        // chat | help
  const [helpEnabled, setHelpEnabled] = useState(false);
  const [help, setHelp] = useState(null);          // { articles, categories }
  const [helpQ, setHelpQ] = useState("");
  const [helpCat, setHelpCat] = useState("");
  const [openArticle, setOpenArticle] = useState(null);
  const bodyRef = useRef(null);

  // never render for guests or admins (admins use the admin support inbox)
  const hidden = !user || user.role === "admin";

  // poll the unread badge (light endpoint; works even if feature is off → 0)
  useEffect(() => {
    if (hidden) return;
    let alive = true;
    const tick = () => api.get("/support/unread").then((d) => { if (alive) { setUnread(d.unread || 0); setEnabled(d.enabled !== false); } }).catch(() => {});
    tick();
    const id = setInterval(tick, 45000);
    return () => { alive = false; clearInterval(id); };
  }, [hidden]);

  const loadThread = () => api.get(`/support/thread?lang=${lang}`).then((d) => { setThread(d); setUnread(0); if (d.ticket?.category) setCategory(d.ticket.category); }).catch(() => setThread({ ticket: null, messages: [], categories: Object.keys(CAT_META) }));

  // is the help center available? (independent of the support flag)
  useEffect(() => {
    if (hidden) return;
    api.get("/support/help/enabled").then((d) => setHelpEnabled(!!d.enabled)).catch(() => {});
  }, [hidden]);

  const HELP_CAT_LABEL = {
    general: { fa: "عمومی", en: "General" }, account: { fa: "حساب کاربری", en: "Account" },
    learning: { fa: "یادگیری", en: "Learning" }, billing: { fa: "پرداخت", en: "Billing" }, technical: { fa: "فنی", en: "Technical" },
  };
  const loadHelp = () => api.get(`/support/help?lang=${lang}${helpQ ? `&q=${encodeURIComponent(helpQ)}` : ""}${helpCat ? `&category=${helpCat}` : ""}`)
    .then((d) => setHelp(d)).catch(() => setHelp({ articles: [], categories: [] }));
  // reload help results when the query/category changes (debounced)
  useEffect(() => {
    if (!open || view !== "help") return;
    const id = setTimeout(loadHelp, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpQ, helpCat, view, open, lang]);

  const openPanel = () => { setOpen(true); loadThread(); };

  /* ---- Launcher placement ----
     The support launcher rests neatly docked as a small tab at the edge of the
     screen so it never blocks page controls or content. It only comes out / opens
     when the user touches/clicks it, avoiding any auto-sliding or jitter loops. */
  const [docked, setDocked] = useState(true);
  const [side, setSide] = useState(() => { try { return localStorage.getItem("support_fab_side") || "end"; } catch { return "end"; } });
  const fabRef = useRef(null);

  // swipe / drag the launcher horizontally to move it to the other side
  const drag = useRef(null);
  const onPointerDown = (e) => { drag.current = { x: e.clientX, moved: false }; };
  const onPointerMove = (e) => { if (drag.current && Math.abs(e.clientX - drag.current.x) > 40) drag.current.moved = true; };
  const onPointerUp = (e) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) {
      const next = e.clientX < window.innerWidth / 2 ? "left" : "right";
      const rtl = document.documentElement.dir === "rtl";
      const logical = (next === "right") === !rtl ? "end" : "start";
      setSide(logical); try { localStorage.setItem("support_fab_side", logical); } catch { /* */ }
      e.preventDefault();
    }
  };
  const onFabClick = (e) => {
    if (drag.current?.moved) { e.preventDefault(); return; }
    openPanel();
  };

  // scroll to newest message
  useEffect(() => { if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [thread, open]);

  // open the chat when a support notification is clicked (medlab-nav "support")
  useEffect(() => {
    const h = (e) => { if (e.detail === "support") openPanel(); };
    window.addEventListener("medlab-nav", h);
    return () => window.removeEventListener("medlab-nav", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (hidden || !enabled) return null;

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const d = await api.post(`/support/message?lang=${lang}`, { body, category });
      setThread(d); setText("");
    } catch { /* */ } finally { setSending(false); }
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const messages = thread?.messages || [];
  const isEmpty = messages.length === 0;
  const resolved = thread?.ticket?.status === "resolved";

  return (
    <>
      {!open && (
        <button ref={fabRef} className={`support-fab${docked ? " docked" : ""} side-${side}`} onClick={onFabClick}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
          aria-label={t("support")} title={t("support")}>
          <Icon name="chat" size={26} />
          {unread > 0 && <span className="support-fab-badge">{unread}</span>}
        </button>
      )}

      {open && (
        <div className={`support-panel side-${side}`} role="dialog" aria-label={t("support")}>
          <div className="support-head">
            <div className="support-head-title">
              <div className="support-avatar">🩺</div>
              <div>
                <div className="support-head-name">{t("supportTitle")}</div>
                <div className="support-head-sub">{t("supportReplyTime")}</div>
              </div>
            </div>
            <button className="support-close" onClick={() => setOpen(false)} aria-label={t("close")}><Icon name="close" size={18} /></button>
          </div>

          {/* tabs: Chat vs Help center (only when help is available) */}
          {helpEnabled && (
            <div className="support-tabs">
              <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}><Icon name="chat" size={14} /> {t("supportTabChat")}</button>
              <button className={view === "help" ? "active" : ""} onClick={() => { setView("help"); setOpenArticle(null); }}><Icon name="book" size={14} /> {t("supportTabHelp")}</button>
            </div>
          )}

          {view === "chat" ? (
            <>
              <div className="support-body" ref={bodyRef}>
                {/* welcome / intro */}
                <div className="support-intro">
                  <div className="support-intro-emoji">👋</div>
                  <div className="support-intro-text">{t("supportWelcome")}</div>
                </div>

                {/* category chooser — only before a conversation starts */}
                {isEmpty && (
                  <div className="support-cats">
                    <div className="small muted mb8">{t("supportPickTopic")}</div>
                    {Object.entries(CAT_META).map(([k, m]) => (
                      <button key={k} className={`support-cat ${category === k ? "active" : ""}`} onClick={() => setCategory(k)}>
                        <span className="sc-emoji">{m.emoji}</span> {lang === "fa" ? m.fa : m.en}
                      </button>
                    ))}
                  </div>
                )}

                {/* message bubbles */}
                {messages.map((mmm) => (
                  <div key={mmm.id} className={`support-msg ${mmm.sender === "user" ? "mine" : "theirs"}`}>
                    {mmm.sender === "admin" && <div className="support-msg-name">{mmm.sender_name || t("supportTitle")}</div>}
                    <div className="support-bubble">{mmm.body}</div>
                    <div className="support-time">{fmtTime(mmm.created_at, lang)}</div>
                  </div>
                ))}

                {resolved && (
                  <div className="support-resolved">✅ {t("supportResolved")}</div>
                )}
              </div>

              <div className="support-compose">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKey}
                  rows={1}
                  placeholder={isEmpty ? t("supportPlaceholderNew").replace("{topic}", lang === "fa" ? CAT_META[category].fa : CAT_META[category].en) : t("supportPlaceholder")}
                />
                <button className="support-send" disabled={sending || !text.trim()} onClick={send} aria-label={t("send")}>
                  <Icon name="send" size={18} />
                </button>
              </div>
            </>
          ) : (
            /* ---- Help center / FAQ ---- */
            <div className="support-body">
              {openArticle ? (
                <div className="help-article">
                  <button className="btn btn-ghost btn-sm mb8" onClick={() => setOpenArticle(null)}><Icon name={lang === "fa" ? "chevronRight" : "chevronLeft"} size={14} /> {t("back")}</button>
                  <h4>{openArticle.title}</h4>
                  <div className="help-article-body">{openArticle.body}</div>
                  <div className="help-still small muted mt16">{t("supportStillNeed")} <button className="link-btn" onClick={() => setView("chat")}>{t("supportTabChat")}</button></div>
                </div>
              ) : (
                <>
                  <div className="help-search">
                    <Icon name="search" size={16} />
                    <input value={helpQ} onChange={(e) => setHelpQ(e.target.value)} placeholder={t("supportHelpSearch")} />
                  </div>
                  <div className="help-cats">
                    <button className={helpCat === "" ? "active" : ""} onClick={() => setHelpCat("")}>{lang === "fa" ? "همه" : "All"}</button>
                    {(help?.categories || []).map((c) => (
                      <button key={c} className={helpCat === c ? "active" : ""} onClick={() => setHelpCat(c)}>{HELP_CAT_LABEL[c] ? (lang === "fa" ? HELP_CAT_LABEL[c].fa : HELP_CAT_LABEL[c].en) : c}</button>
                    ))}
                  </div>
                  {help && help.articles.length === 0 && <div className="small muted center" style={{ padding: 20 }}>{t("supportHelpEmpty")}</div>}
                  {(help?.articles || []).map((a) => (
                    <button key={a.id} className="help-item" onClick={() => api.get(`/support/help/${a.id}?lang=${lang}`).then((d) => setOpenArticle(d.article)).catch(() => {})}>
                      <Icon name="book" size={15} /> <span>{a.title}</span>
                      <Icon name={lang === "fa" ? "chevronLeft" : "chevronRight"} size={14} />
                    </button>
                  ))}
                  <div className="help-still small muted center mt16">{t("supportStillNeed")} <button className="link-btn" onClick={() => setView("chat")}>{t("supportTabChat")}</button></div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function fmtTime(iso, lang) {
  if (!iso) return "";
  try {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    return new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(d);
  } catch { return ""; }
}
