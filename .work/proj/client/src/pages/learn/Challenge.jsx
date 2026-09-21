import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";

export default function Challenge() {
  const { t, lang } = useApp();
  const [view, setView] = useState("list"); // list | play | result
  const [mine, setMine] = useState([]);
  const [topics, setTopics] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [active, setActive] = useState(null); // {challenge, cards}
  const [outcome, setOutcome] = useState(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    api.get(`/challenge/mine?lang=${lang}`).then((d) => setMine(d.challenges)).catch(() => setMine([]));
    api.get(`/learn/path?lang=${lang}`).then((d) => setTopics(d.topics.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  };
  useEffect(() => { load(); }, [lang]);

  const create = async (topicId) => {
    setMsg("");
    try { const r = await api.post("/challenge/create", { topicId }); setMsg((lang === "fa" ? "کد چالش: " : "Code: ") + r.code); load(); }
    catch { setMsg("Error"); }
  };
  const join = async () => {
    setMsg("");
    try { const r = await api.post("/challenge/join", { code: joinCode }); setJoinCode(""); load(); play(r.id); }
    catch (e) { setMsg(lang === "fa" ? "کد نامعتبر یا پر است" : "Invalid or full code"); }
  };
  const play = async (id) => {
    try { const d = await api.get(`/challenge/${id}/play?lang=${lang}`); setActive(d); setView("play"); }
    catch (e) { setMsg(e.message === "already played" ? (lang === "fa" ? "قبلاً بازی کرده‌ای" : "Already played") : e.message); load(); }
  };
  const quickMatch = async () => {
    setMsg("");
    try {
      const r = await api.post("/challenge/quick", {});
      if (r.matched) { play(r.id); }
      else { setMsg(lang === "fa" ? "منتظر حریف… به‌محض پیوستن کسی، اعلان می‌گیری." : "Waiting for an opponent… you'll be notified when someone joins."); load(); }
    } catch (e) { setMsg(e.message); }
  };

  if (view === "play" && active)
    return <ChallengePlay data={active} onDone={(oc) => { setOutcome(oc); setView("result"); load(); }} />;

  if (view === "result")
    return (
      <div className="page">
        <div className="celebrate card">
          <div style={{ color: outcome?.iWon ? "var(--xp)" : "var(--muted)" }}><Icon name="trophy" size={56} /></div>
          <h2 style={{ border: "none" }}>{outcome?.finished ? (outcome.iWon ? t("youWon") : outcome.tie ? t("tie") : t("youLost")) : t("waitOpponent")}</h2>
          <div className="big">{outcome?.myScore}</div>
          <button className="btn btn-primary mt16" onClick={() => setView("list")}>{t("back")}</button>
        </div>
      </div>
    );

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="trophy" size={22} /> {t("challenges")}</h2></div>
      <div className="muted small mb16">{t("challengeDesc")}</div>

      {/* Quick match — auto-matchmaking (competitors require sharing a code) */}
      <button className="btn btn-accent btn-block mb16 quick-match-btn" onClick={quickMatch}>
        <Icon name="bolt" size={16} /> {t("quickMatch")}
      </button>

      <div className="grid grid-2 mb16">
        <div className="card ch-setup-card">
          <h4 className="mb8"><Icon name="crown" size={16} /> {t("newChallenge")}</h4>
          <div className="small muted mb8">{t("pickTopicChallenge")}</div>
          <div className="ch-topics">
            {topics.slice(0, 6).map((tp) => (
              <button key={tp.id} className="btn btn-ghost btn-sm ch-topic-pill" onClick={() => create(tp.id)}>{tp.name}</button>
            ))}
          </div>
        </div>
        <div className="card ch-setup-card">
          <h4 className="mb8"><Icon name="users" size={16} /> {t("joinChallenge")}</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t("enterCode")} style={{ fontFamily: "monospace", letterSpacing: 2 }} />
            <button className="btn btn-accent" onClick={join}>{t("join")}</button>
          </div>
        </div>
      </div>
      {msg && <div className="card center mb16"><span className="code-pill">{msg}</span></div>}

      <h4 className="mb8"><Icon name="clock" size={16} /> {t("myChallenges")}</h4>
      {mine.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="trophy" size={40} /></div><h3>{t("noChallenges")}</h3></div>}
      {mine.map((c) => (
        <div key={c.id} className="vs-card">
          <div className="vs-side">
            <div className="vs-name">{lang === "fa" ? "شما" : "You"}</div>
            <div className="vs-score">{c.myScore || "—"}</div>
          </div>
          <div className="vs-mid">
            <div>VS</div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {c.status === "open" ? <span className="code-pill" style={{ fontSize: ".9rem", padding: "4px 10px" }}>{c.code}</span>
                : c.status === "finished" ? (c.iWon ? "🏆 " + t("youWon") : c.tie ? t("tie") : t("youLost"))
                : t("inProgress")}
            </div>
          </div>
          <div className="vs-side">
            <div className="vs-name">{c.opponentName || (lang === "fa" ? "منتظر حریف" : "Waiting…")}</div>
            <div className="vs-score">{c.otherScore || "—"}</div>
          </div>
          {(c.status === "active" && !c.myDone) && <button className="btn btn-primary btn-sm" onClick={() => play(c.id)}>{t("play")}</button>}
          {(c.status === "open" && c.role === "creator") && <span className="tag">{t("shareCode")}</span>}
        </div>
      ))}
    </div>
  );
}

function ChallengePlay({ data, onDone }) {
  const { t, lang } = useApp();
  const cards = data.cards;
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const startRef = useRef(Date.now());

  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);

  const check = () => {
    const right = Type.judge(card, { sel });
    setChecked(true);
    if (right) setCorrect((c) => c + 1);
  };
  const next = async () => {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); return; }
    const time = Date.now() - startRef.current;
    const final = correct + (Type.judge(card, { sel }) ? 0 : 0); // correct already counted at check
    try {
      const oc = await api.post(`/challenge/${data.challenge.id}/submit`, { correct, total: cards.length, time_ms: time });
      onDone(oc);
    } catch { onDone({ myScore: `${correct}/${cards.length}` }); }
  };

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <div className="pbar"><span style={{ width: `${Math.round((idx / cards.length) * 100)}%` }} /></div>
        <span className="hud-chip xp" style={{ fontSize: ".9rem" }}><Icon name="medal" size={14} /> {correct}</span>
      </div>
      <div className="small muted" style={{ textAlign: "center" }}>{idx + 1} {t("of")} {cards.length}</div>
      <div className="lesson-q">{card.q}</div>
      <Type card={card} checked={checked} sel={sel} setSel={setSel} />
      {checked && card.micro && <MicroLesson micro={card.micro} defaultOpen={false} />}
      <div className="mt16">
        {!checked
          ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("checkAns")}</button>
          : <button className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length ? t("nextQ") : t("finishExam")}</button>}
      </div>
    </div>
  );
}
