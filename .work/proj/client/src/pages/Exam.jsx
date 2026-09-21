import { spokenHistory } from "../lib/vpatient-history.js";
import { useEffect, useRef, useState } from "react";
import { markBusy } from "../lib/sw-update.js";
import { useApp } from "../context.jsx";
import { api, getToken } from "../api.js";
import { TopBar, Spinner } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import OrderSearch from "../components/OrderSearch.jsx";
import { useAntiCheat } from "../utils/antiCheat.js";
import Icon from "../components/Icon.jsx";
import ClinicalLesson, { EvaluationProvenance } from "../components/ClinicalLesson.jsx";

/* Named steps of the virtual-patient path so a failure is never a silent
   reset: the student sees WHERE it stopped (case / consent / session / chat /
   order / evaluate) and WHY. */
const STAGES = {
  case: { fa: "بارگذاری پرونده", en: "Loading the case" },
  consent: { fa: "رضایت پژوهشی", en: "Research consent" },
  session: { fa: "شروع جلسه", en: "Opening the session" },
  access: { fa: "بررسی دسترسی", en: "Checking access" },
  chat: { fa: "گفت‌وگوی بیمار", en: "Patient chat" },
  order: { fa: "سفارش آزمایش/پاراکلینیک/تصویر", en: "Lab / paraclinic / imaging order" },
  evaluate: { fa: "ارزیابی پایان آزمون", en: "Final evaluation" },
  exam: { fa: "آزمون", en: "Exam" },
  boot: { fa: "راه‌اندازی", en: "Startup" },
  auth: { fa: "ورود", en: "Sign-in" },
};
function stageTitle(stage, lang) {
  const s = STAGES[stage] || STAGES.boot;
  return lang === "fa" ? s.fa : s.en;
}
function refusalMessage(e, t, lang, stage) {
  const reason = e?.data?.reason;
  const st = stage || e?.data?.stage;
  const prefix = st ? (lang === "fa" ? `«${stageTitle(st, lang)}» — ` : `[${stageTitle(st, lang)}] `) : "";
  if (e?.data?.error === "evaluation_in_progress") {
    return prefix + (lang === "fa" ? "ارزیابی هنوز در حال انجام است. کمی صبر کنید و دوباره پایان و ارزیابی را بزنید؛ نتیجهٔ قبلی دوباره نمره‌دهی نمی‌شود." : "Evaluation is still running. Wait briefly and retry Finish to retrieve the result without grading again.");
  }
  if (e?.data?.error === "ai_evaluation_unavailable") {
    const fa = lang === "fa";
    const stageName = e.data.aiStage === "checklist" ? (fa ? "نمره‌دهی معیارها" : "Checklist scoring")
      : e.data.aiStage === "lesson" ? (fa ? "تولید درسنامه" : "Lesson generation") : (fa ? "تنظیم اتصال" : "Connection configuration");
    const reasons = {
      configuration: fa ? "اتصال فعال و کلید مدل را در پنل ادمین بررسی کنید." : "Check the enabled model connection and key in the admin panel.",
      rate_limit: fa ? "سهمیه یا نرخ درخواست سرویس محدود شده؛ تکرار فوری کمکی نمی‌کند. تا بازشدن سهمیه صبر کنید یا ادمین اتصال مجاز دیگری انتخاب کند." : "The provider rate/quota limit was reached. Immediate retries will not help; wait for quota recovery or ask the administrator to select another permitted connection.",
      credits: fa ? "اعتبار یا سقف هزینهٔ سرویس را ادمین بررسی کند." : "Ask the administrator to check provider credits or spending limits.",
      credentials: fa ? "کلید اتصال نامعتبر یا منقضی است؛ ادمین آن را بررسی کند." : "The connection key is invalid or expired; ask the administrator to check it.",
      access_denied: fa ? "سرویس اجازهٔ پاسخ نداده است؛ ادمین دسترسی مدل را بررسی کند." : "The provider refused access; ask the administrator to check model access.",
      timeout: fa ? "مدل در مهلت تعیین‌شده پاسخ کامل نداد؛ از اتصال سریع‌ترِ مجاز استفاده کنید." : "The model did not finish within its time budget; use a faster permitted connection.",
      cooldown: fa ? "اتصال‌ها موقتاً در زمان انتظار بازیابی هستند؛ کمی بعد تلاش کنید." : "Connections are temporarily cooling down; retry later.",
      invalid_output: fa ? "پاسخ مدل کامل یا مطابق قالب ارزیابی نبود؛ نمرهٔ ناقص ثبت نشد." : "The model response was incomplete or did not match the evaluation format; no partial grade was saved.",
      provider_unavailable: fa ? "ارتباط با سرویس مدل برقرار نشد یا سرویس پاسخ معتبر نداد." : "The model service was unavailable or did not return a valid response.",
    };
    return prefix + stageName + " — " + (reasons[e.data.failureCode] || reasons.provider_unavailable) + " " + (fa
      ? "نمره‌ای ثبت نشده و فرصتی کسر نشده است. صفحه را باز نگه دارید. در تلاش مجددِ بدون تغییر، نمره‌دهی موفق قبلی تا دو دقیقه در حافظهٔ موقت سرور قابل استفاده است."
      : "No grade was saved or attempt consumed. Keep this page open. An unchanged retry can reuse successful checklist judgments held in server memory for up to two minutes.");
  }
  if (e?.status === 401) return prefix + (lang === "fa" ? "نشست شما منقضی شده. دوباره وارد شوید." : "Your session expired. Please sign in again.");
  if (reason === "attempts_exhausted") return prefix + t("attemptsExhausted");
  if (reason === "window") return prefix + (lang === "fa" ? "پنجرهٔ زمانی این آزمون بسته است." : "This exam's time window is closed.");
  if (reason === "off") return prefix + (lang === "fa" ? "بیمار مجازی الان خاموش است." : "Virtual patient is turned off.");
  if (reason === "premium") return prefix + (lang === "fa" ? "این قابلیت ویژهٔ پریمیوم است." : "This feature needs a premium account.");
  if (reason === "university_only" || e?.data?.error === "university_only") {
    return prefix + (lang === "fa" ? "این کیس مال مسیر دانشگاه است، نه مسیر رقابتی." : "This case belongs to the university track, not the competitive track.");
  }
  if (reason === "wrong_track" || e?.data?.error === "wrong_track") {
    return prefix + (lang === "fa" ? "این محتوا مال مسیر دیگر است." : "This content belongs to the other track.");
  }
  if (e?.data?.error === "study_context_changed") {
    return prefix + (lang === "fa" ? "مطالعهٔ متصل به این جلسه تغییر کرده است. این جلسه به مطالعهٔ جدید منتقل نشد؛ با مسئول مطالعه هماهنگ کنید." : "The study linked to this session has changed. This session was not transferred; contact the study coordinator.");
  }
  if (reason === "research_paused") return prefix + (lang === "fa" ? "مشارکت پژوهشی و ثبت گفت‌وگو به دستور ادمین متوقف شده است. برای ادامه با ادمین تماس بگیرید." : "Participation and recording have been paused by an administrator. Contact the administrator to continue.");
  if (reason === "consent_stale") {
    return prefix + (lang === "fa" ? "متن یا نسخهٔ رضایت‌نامه تغییر کرده است؛ پیش از ادامه باید متن جدید را بخوانید و دوباره رضایت بدهید." : "The consent wording or protocol has changed. Review the updated consent before continuing.");
  }
  if (reason === "consent_required" || reason === "consent_withdrawn" || reason === "consent_stale") {
    return prefix + (lang === "fa" ? "برای ورود به این بیمار باید رضایت پژوهشی ثبت شود." : "Research consent is required before this encounter.");
  }
  if (e?.data?.error === "empty_reply") {
    return prefix + (lang === "fa" ? "پاسخ بیمار خالی برگشت. دوباره بفرستید." : "The patient reply came back empty. Please send again.");
  }
  if (e?.data?.error === "empty_result") {
    return prefix + (lang === "fa" ? "نتیجهٔ آزمایش خالی برگشت. دوباره سفارش دهید." : "The lab result came back empty. Please order again.");
  }
  if (!e?.status) {
    if (e?.data?.error === "timeout") {
      return prefix + (lang === "fa" ? "زمان این مرحله تمام شد. دوباره تلاش کنید." : "This step timed out. Please try again.");
    }
    return prefix + (lang === "fa" ? "اتصال قطع شد. دوباره تلاش کنید." : "Connection lost. Please try again.");
  }
  return prefix + (e?.message || t("errorGeneric"));
}

function examChrome(embedded, home, inner) {
  if (embedded) return inner;
  return <div className="app"><TopBar onHome={home} />{inner}</div>;
}

function orderLabel(v, lang) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  const fa = String(v.fa || v.name_fa || "").trim();
  const en = String(v.en || v.name_en || "").trim();
  return lang === "en" ? (en || fa) : (fa || en);
}

function mergeOrderCatalog(a, b) {
  const out = [];
  const seen = new Set();
  for (const item of [...(a || []), ...(b || [])]) {
    const key = `${String(item?.en || item?.name_en || "").toLowerCase()}|${String(item?.fa || item?.name_fa || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}



export default function Exam({ caseId, classId, examId, examDuration, antiCheat, go, home, embedded = false }) {
  // Tell sw-update.js that in-progress work is on screen: a new build must
  // not auto-reload the page until this screen unmounts.
  useEffect(() => { markBusy(true); return () => markBusy(false); }, []);
  const { t, lang, user } = useApp();
  const [caseData, setCaseData] = useState(null);
  const [settings, setSettings] = useState({ duration: 15 });
  const [phase, setPhase] = useState("exam"); // exam | evaluating | report
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [typingKind, setTypingKind] = useState("chat");
  const [input, setInput] = useState("");
  const [tab, setTab] = useState("history");
  // Phones: the chat and the case panel are shown one at a time (segmented
  // switch below the title) instead of a very long stacked page.
  const [pane, setPane] = useState("chat");
  const [tests, setTests] = useState([]);
  const [imaging, setImaging] = useState([]);
  const [paraclinic, setParaclinic] = useState([]);
  const [orderCat, setOrderCat] = useState({ labs: [], imaging: [], paraclinic: [] });
  /* Images the student has REQUESTED so far (imaging / paraclinic orders that
     came back with a picture). The "images" tab starts EMPTY and only fills
     as studies are ordered — nothing is revealed up front. */
  const [requestedImages, setRequestedImages] = useState([]);
  // Staff (teacher/admin) may see the internal case title; students only the
  // chief complaint so the title cannot hint at the diagnosis.
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const [ddx, setDdx] = useState([]);
  const [finalDx, setFinalDx] = useState("");
  /* Problem list (one problem per line) — filled BEFORE ordering tests.
     It is part of the EXTERN criterion (externs are graded up to it). */
  const [problemList, setProblemList] = useState("");
  /* The class's grading criterion (extern/intern/overall) — stamped by the
     server at session start, shown so the student knows what is graded. */
  const [gradingScope, setGradingScope] = useState("overall");
  const [loggingOn, setLoggingOn] = useState(false);
  const finishingRef = useRef(false);
  const sendingRef = useRef(false);
  const orderQueueRef = useRef(Promise.resolve());
  const pendingChatRef = useRef(Promise.resolve());
  const encounterGeneration = useRef(0);
  const autoFinishTried = useRef(false);
  const examSnapRef = useRef({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [evalRes, setEvalRes] = useState(null);
  const [error, setError] = useState("");   // server-side refusal (e.g. attempts exhausted)
  /* Boot path: loading → consent | ready | blocked | error. Timer and chat
     must not start until status === "ready" (session opened). */
  const [boot, setBoot] = useState({ status: "loading", stage: "case" });
  const [bootKey, setBootKey] = useState(0);
  /* Research consent. `null` = not checked yet. The gate is checked BEFORE the
     encounter is opened, so no session row and no transcript can exist for a
     participant who has not agreed to take part. */
  const [consent, setConsent] = useState(null);
  const [consentBusy, setConsentBusy] = useState(false);
  /* Conversation logging (research). The server decides whether this encounter
     is recorded at all (per-class switch); we buffer timestamped events here and
     send them with the evaluation. The buffer is only uploaded when the server
     said logging is on, so nothing leaves the browser otherwise. */
  const sessionIdRef = useRef(null);
  const eventsRef = useRef([]);
  const loggingRef = useRef(false);
  const logEvent = (kind, extra = {}) => {
    if (!loggingRef.current) return;
    eventsRef.current.push({ kind, atMs: Date.now() - startRef.current, ...extra });
  };
  const { leaves } = useAntiCheat(!!examId && antiCheat && phase === "exam");
  const startRef = useRef(Date.now());
  const chatEnd = useRef(null);

  const applySession = (sess, mins) => {
    if (!sess?.sessionId) {
      throw Object.assign(new Error("session_failed"), { status: 502, data: { error: "session_failed", stage: "session" } });
    }
    sessionIdRef.current = sess.sessionId;
    loggingRef.current = !!sess.loggingEnabled;
    setLoggingOn(!!sess.loggingEnabled);
    if (sess.gradingScope) setGradingScope(sess.gradingScope);
    startRef.current = Date.now();
    setTimeLeft(mins * 60);
    autoFinishTried.current = false;
    finishingRef.current = false;
    setBoot({ status: "ready", stage: "exam" });
  };

  const requestSession = async () => {
    const requestId = globalThis.crypto?.randomUUID?.() || `start-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { caseId, classId, examId, lang, requestId };
    try {
      return await api.post("/exam/session-start", payload, { timeoutMs: 20_000, stage: "session" });
    } catch (e) {
      const retryable = !e?.status || e.status >= 500;
      if (!retryable) throw e;
      return await api.post("/exam/session-start", payload, { timeoutMs: 20_000, stage: "session" });
    }
  };

  const failBoot = (e, fallbackStage) => {
    const blocked = e?.status === 403 || e?.status === 401;
    setBoot({
      status: blocked ? "blocked" : "error",
      stage: e?.data?.stage || (e?.status === 401 ? "auth" : fallbackStage),
      error: refusalMessage(e, t, lang, e?.data?.stage || fallbackStage),
    });
  };

  // Competitive learners share <Exam> inside LearnApp, which has no classes/exams routes.
  const leaveExam = () => {
    if (user?.role === "learner") { go?.("caseList"); return; }
    go?.(examId ? "exams" : classId ? "classes" : "caseList");
  };

  const consentFromDenial = (e) => ({
    required: true,
    granted: false,
    reason: e?.data?.reason || "consent_required",
    studyId: e?.data?.studyId,
    titleFa: e?.data?.titleFa || "",
    titleEn: e?.data?.titleEn || "",
    consentTextFa: e?.data?.consentTextFa || "",
    consentTextEn: e?.data?.consentTextEn || "",
    ethicsCode: e?.data?.ethicsCode || "",
    protocolVersion: e?.data?.protocolVersion || "",
  });

  useEffect(() => {
    let cancelled = false;
    encounterGeneration.current++;
    pendingChatRef.current = Promise.resolve(); orderQueueRef.current = Promise.resolve();
    examSnapRef.current = { messages: [], tests: [], imaging: [], paraclinic: [], ddx: [], finalDx: "", problemList: "" };
    setTyping(false);
    setMessages([]); setTests([]); setParaclinic([]); setRequestedImages([]); setImaging([]); setDdx([]); setFinalDx(""); setProblemList("");
    setPhase("exam"); setEvalRes(null); setTimeLeft(null); setError("");
    sessionIdRef.current = null; eventsRef.current = [];
    finishingRef.current = false; sendingRef.current = false; autoFinishTried.current = false;
    (async () => {
      setBoot({ status: "loading", stage: "case" });
      setError("");
      try {
        let c, s, oc = null, cs = null;
        try {
          // Competitive learners must not read university exam flags. Duration
          // still comes from examDuration or the local default so boot does not fail.
          const skipUniExamSettings = user?.role === "learner";
          const [caseRes, settingsRes, catRes, consentRes] = await Promise.all([
            api.get(`/cases/${caseId}`, { timeoutMs: 20_000, stage: "case" }),
            skipUniExamSettings
              ? Promise.resolve({ duration: 15, showHints: true, showCorrect: true, showAiAnalysis: true, showMicro: true })
              : api.get("/settings/exam", { timeoutMs: 20_000, stage: "boot" }),
            api.get("/order-catalog", { timeoutMs: 20_000, stage: "order" }),
            api.get(`/research/consent/status?classId=${classId || ""}&examId=${examId || ""}&caseId=${caseId || ""}`, { timeoutMs: 15_000, stage: "consent" }),
          ]);
          c = caseRes; s = settingsRes; oc = catRes; cs = consentRes;
        } catch (e) {
          if (cancelled) return;
          failBoot(e, e?.data?.stage || "case");
          return;
        }
        if (cancelled) return;
        setOrderCat({
          labs: Array.isArray(oc?.labs) ? oc.labs : [],
          imaging: Array.isArray(oc?.imaging) ? oc.imaging : [],
          paraclinic: Array.isArray(oc?.paraclinic) ? oc.paraclinic : [],
        });
        const mins = examDuration || s.duration || 15;
        setCaseData(c); setSettings(s);
        setBoot({ status: "loading", stage: "consent" });
        if (cancelled) return;
        setConsent(cs);
        // Do NOT start the timer on the consent screen — previously timeLeft
        // was set here and auto-finished the exam while the student was reading.
        if (cs && cs.required && !cs.granted) {
          setBoot({ status: "consent", stage: "consent" });
          return;
        }
        setBoot({ status: "loading", stage: "session" });
        try {
          const sess = await requestSession();
          if (cancelled) return;
          applySession(sess, mins);
        } catch (e) {
          if (cancelled) return;
          if (e?.data?.reason === "consent_required" || e?.data?.reason === "consent_withdrawn" || e?.data?.reason === "consent_stale") {
            try {
              const fresh = await api.get(`/research/consent/status?classId=${classId || ""}&examId=${examId || ""}`, { timeoutMs: 15_000, stage: "consent" });
              if (cancelled) return;
              setConsent(fresh?.required ? fresh : consentFromDenial(e));
              setBoot({ status: "consent", stage: "consent" });
              return;
            } catch {
              if (cancelled) return;
              setConsent(consentFromDenial(e));
              setBoot({ status: "consent", stage: "consent" });
              return;
            }
          }
          failBoot(e, "session");
        }
      } catch (e) {
        if (cancelled) return;
        failBoot(e, "case");
      }
    })();
    return () => { cancelled = true; };
  }, [caseId, classId, examId, bootKey]);

  const agreeConsent = async () => {
    setConsentBusy(true);
    setError("");
    try {
      await api.post("/research/consent", { study_id: consent.studyId }, { timeoutMs: 15_000, stage: "consent" });
      const fresh = await api.get(`/research/consent/status?classId=${classId || ""}&examId=${examId || ""}`, { timeoutMs: 15_000, stage: "consent" });
      setConsent(fresh);
      const mins = examDuration || settings.duration || 15;
      setBoot({ status: "loading", stage: "session" });
      const sess = await requestSession();
      applySession(sess, mins);
      logEvent("consent_granted", { studyId: consent.studyId });
    } catch (e) {
      if (e?.data?.reason === "consent_required" || e?.data?.reason === "consent_withdrawn" || e?.data?.reason === "consent_stale") {
        setConsent(consentFromDenial(e));
        setBoot({ status: "consent", stage: "consent" });
      } else {
        failBoot(e, e?.data?.stage || "consent");
      }
    } finally { setConsentBusy(false); }
  };
  const declineConsent = async () => {
    setConsentBusy(true);
    try { await api.post("/research/consent/withdraw", { study_id: consent.studyId, note: "declined at entry" }); }
    catch { /* declining needs no record to succeed */ }
    finally { setConsentBusy(false); leaveExam(); }
  };

  /* An abandoned session is meaningful for the study (it is a dropout data
     point, and the partial transcript shows where they got stuck). Uses fetch
     with keepalive rather than sendBeacon because the auth token has to travel
     as a header, which sendBeacon cannot set. */
  useEffect(() => () => {
    if (finishingRef.current) return;
    if (!sessionIdRef.current || !loggingRef.current || !eventsRef.current.length) return;
    try {
      fetch("/api/exam/session-abandon", {
        method: "POST", keepalive: true, credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current, events: eventsRef.current }),
      }).catch(() => {});
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    if (boot.status !== "ready" || timeLeft == null || phase !== "exam") return;
    if (timeLeft <= 0) {
      if (autoFinishTried.current) return;
      autoFinishTried.current = true;
      finish();
      return;
    }
    const id = setTimeout(() => setTimeLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, phase, boot.status]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Update the submission snapshot synchronously: network replies can arrive
  // in the same tick as Finish, before React has committed a render.
  const appendMessage = (message) => {
    const next = [...(examSnapRef.current.messages || []), message];
    examSnapRef.current = { ...examSnapRef.current, messages: next };
    setMessages(next);
  };
  const snapPatch = (patch) => {
    examSnapRef.current = { ...examSnapRef.current, ...patch };
  };
  const setProblemListSync = (v) => {
    const cur = examSnapRef.current.problemList || "";
    const next = typeof v === "function" ? v(cur) : v;
    snapPatch({ problemList: next });
    setProblemList(next);
  };
  const setDdxSync = (v) => {
    const cur = examSnapRef.current.ddx || [];
    const next = typeof v === "function" ? v(cur) : v;
    snapPatch({ ddx: next });
    setDdx(next);
  };
  const setFinalDxSync = (v) => {
    const cur = examSnapRef.current.finalDx || "";
    const next = typeof v === "function" ? v(cur) : v;
    snapPatch({ finalDx: next });
    setFinalDx(next);
  };

  const send = async () => {
    const text = input.trim(); if (!text) return;
    if (finishingRef.current || sendingRef.current || typing) return;
    const generation = encounterGeneration.current;
    let settleChat;
    pendingChatRef.current = new Promise(resolve => { settleChat = resolve; });
    sendingRef.current = true;
    let priorHistory = [];
    try { priorHistory = spokenHistory(messages); } catch { priorHistory = []; }
    appendMessage({ role: "student", text });
    logEvent("student_msg", { text });
    setInput(""); setTypingKind("chat"); setTyping(true);
    try {
      const reply = await api.post("/exam/patient-reply",
        { caseId, userText: text, history: priorHistory, lang, classId, examId },
        { timeoutMs: 60_000, stage: "chat" });
      if (generation !== encounterGeneration.current) return;
      const replyText = String(reply?.text || "").trim();
      if (!replyText) {
        throw Object.assign(new Error("empty_reply"), { status: 502, data: { error: "empty_reply", stage: "chat" } });
      }
      // mode "exam" = the AI answered as the SUPERVISING TEACHER with the
      // recorded examination findings (and, when asked, the lung/heart
      // auscultation recording attached as a playable audio in the bubble).
      if (reply.mode === "exam") {
        logEvent("exam_request", { text });
        logEvent("teacher_msg", { text: reply.text, source: reply.source });
        if (reply.audio?.length) logEvent("auscultation", {
          organs: reply.audio.map((a) => a.kind).join(","), hasAudio: true });
      } else {
        logEvent("patient_msg", { text: reply.text, source: reply.source });
      }
      appendMessage({ role: "patient", text: replyText,
        mode: reply.mode || "patient", audio: reply.audio || null });
    } catch (e) {
      if (generation !== encounterGeneration.current) return;
      const stage = e?.data?.stage || (e?.status === 401 ? "auth" : "chat");
      const msg = refusalMessage(e, t, lang, stage);
      appendMessage({ role: "system", stage, text: msg });
      setError(msg);
    } finally {
      if (generation === encounterGeneration.current) { setTyping(false); sendingRef.current = false; }
      settleChat();
    }
  };

  // When a student orders a test/imaging, fetch the lab/radiology report and
  // drop it into the chat (recorded result, or "normal" if not in the chart).
  const orderResult = (kind, query) => {
    if (finishingRef.current) return Promise.resolve({ ok: false });
    const q = String(query || "").trim();
    if (!q) return Promise.resolve({ ok: false });
    const generation = encounterGeneration.current;
    const run = async () => {
      if (generation !== encounterGeneration.current) return { ok: false };
      setTypingKind("order");
      setTyping(true);
      try {
        const r = await api.post("/exam/order", { caseId, kind, query: q, lang, classId, examId },
          { timeoutMs: 60_000, stage: "order" });
        if (generation !== encounterGeneration.current) return { ok: false };
        const text = String(r?.text || "").trim();
        if (!text) {
          throw Object.assign(new Error("empty_result"), { status: 502, data: { error: "empty_result", stage: "order" } });
        }
        const bucket = kind === "lab" ? "tests" : kind === "paraclinic" ? "paraclinic" : "imaging";
        const prior = examSnapRef.current[bucket] || [];
        examSnapRef.current = { ...examSnapRef.current, [bucket]: prior.some(x => x.toLowerCase() === q.toLowerCase()) ? prior : [...prior, q] };
        const update = kind === "lab" ? setTests : kind === "paraclinic" ? setParaclinic : setImaging;
        update(prev => prev.some(x => x.toLowerCase() === q.toLowerCase()) ? prev : [...prev, q]);
        appendMessage({ role: "lab", text, imageUrl: r.imageUrl || null });
        // The picture (ECG strip, CXR, …) goes BOTH into the chat and the images tab.
        if (r.imageUrl) {
          setRequestedImages((prev) => prev.some((im) => im.url === r.imageUrl) ? prev
            : [...prev, { url: r.imageUrl, label: q, kind }]);
        }
        const evKind = kind === "lab" ? "lab" : kind === "paraclinic" ? "paraclinic" : "imaging";
        logEvent(`${evKind}_order`, { query: q });
        logEvent(`${evKind}_result`, { query: q, text, found: r.found });
        return { ok: true };
      } catch (e) {
        if (generation !== encounterGeneration.current) return { ok: false };
        const stage = e?.data?.stage || "order";
        let msg;
        if (e?.status === 400 && (e?.data?.error === "not_in_catalog" || e?.data?.error === "query_required")) {
          msg = lang === "fa"
            ? "«سفارش آزمایش/تصویر» — این مورد در فهرست سفارش‌های مجاز نیست."
            : "[Lab / imaging order] That item is not in the allowed order catalog.";
        } else {
          msg = refusalMessage(e, t, lang, stage);
          setError(msg);
        }
        appendMessage({ role: "system", stage, text: msg });
        return { ok: false };
      } finally { if (generation === encounterGeneration.current) setTyping(false); }
    };
    const p = orderQueueRef.current.then(run, run);
    orderQueueRef.current = p.then(() => undefined, () => undefined);
    return p;
  };

  const finish = async () => {
    // BUGFIX: the timer firing finish() and a fast double-click on the button
    // could both reach /exam/evaluate → two attempts, double attempt-budget
    // consumption. The ref makes the request fire exactly once.
    if (finishingRef.current) return;
    finishingRef.current = true;
    const generation = encounterGeneration.current;
    setPhase("evaluating");
    await Promise.all([pendingChatRef.current, orderQueueRef.current]);
    if (generation !== encounterGeneration.current) return;
    const snap = examSnapRef.current || {};
    const problemLines = String(snap.problemList || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const session = {
      messages: snap.messages || [], tests: snap.tests || [], imaging: snap.imaging || [],
      paraclinic: snap.paraclinic || [],
      ddx: snap.ddx || [], finalDx: snap.finalDx || "", problemList: problemLines,
    };
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    if (problemLines.length) logEvent("problem_list", { lines: problemLines.length, text: problemLines.join("\n") });
    logEvent("finish", {});
    try {
      const payload = {
        caseId, session, lang, durationSec, classId, examId,
        sessionId: sessionIdRef.current,
        events: loggingRef.current ? eventsRef.current : [],
      };
      const postEval = () => api.post("/exam/evaluate", payload, { timeoutMs: 180_000, stage: "evaluate" });
      const retryableEval = (e) => {
        const err = e?.data?.error;
        if (err === "ai_evaluation_unavailable" || err === "session_id_required" || err === "session_closed") return false;
        if (err === "evaluation_in_progress" || err === "timeout" || err === "network") return true;
        if (e?.status === 409 && e?.data?.retryable) return true;
        if (!e?.status) return true;
        return false;
      };
      const deadline = Date.now() + 90_000;
      let waitMs = 2000;
      let res;
      for (;;) {
        try {
          res = await postEval();
          break;
        } catch (e) {
          if (!retryableEval(e) || Date.now() >= deadline) throw e;
          await new Promise((r) => setTimeout(r, waitMs));
          waitMs = Math.min(8000, waitMs + 2000);
          if (generation !== encounterGeneration.current) return;
        }
      }
      if (generation !== encounterGeneration.current) return;
      eventsRef.current = [];   // uploaded; don't resend if the view re-mounts
      setEvalRes(res); setPhase("report");
      if (user?.role === "learner" && !classId && !examId) {
        api.post("/learn/vpatient/daily-reward", { caseId }, { timeoutMs: 15_000, stage: "report" }).catch(() => {});
      }
    } catch (e) {
      if (generation !== encounterGeneration.current) return;
      const stage = e?.data?.stage || (e?.status === 401 ? "auth" : "evaluate");
      setError(refusalMessage(e, t, lang, stage));
      setPhase("exam");
      finishingRef.current = false;   // let the student try again
      autoFinishTried.current = false;
      // Only freeze the clock when it already hit 0:00 — a mid-exam evaluate
      // failure must not wipe remaining time.
      setTimeLeft((prev) => (prev != null && prev <= 0 ? null : prev));
    }
  };

  if (boot.status === "loading" || (!caseData && boot.status !== "blocked" && boot.status !== "error")) {
    return examChrome(embedded, home, (
      <div className="center-screen"><div className="card center" style={{ maxWidth: 420 }}>
        <Spinner />
        <div className="muted small mt8">{stageTitle(boot.stage || "case", lang)}</div>
      </div></div>
    ));
  }

  if (boot.status === "blocked" || boot.status === "error") {
    const fa = lang === "fa";
    return examChrome(embedded, home, (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 520, textAlign: fa ? "right" : "left" }}>
          <h3><Icon name="warn" size={18} /> {stageTitle(boot.stage, lang)}</h3>
          <div className="err-banner mt12">{boot.error || error || t("errorGeneric")}</div>
          <div className="small muted mt8">
            {fa ? "اگر مشکل ادامه داشت، این مرحله را به استاد بگویید." : "If this keeps happening, tell your instructor which step failed."}
          </div>
          <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
            {boot.status === "error" && (
              <button className="btn btn-primary" onClick={() => { setBoot({ status: "loading", stage: "case" }); setBootKey((k) => k + 1); }}>
                {fa ? "تلاش دوباره" : "Try again"}
              </button>
            )}
            <button className="btn btn-ghost" onClick={leaveExam}>
              {fa ? "بازگشت" : "Back"}
            </button>
          </div>
        </div>
      </div>
    ));
  }

  if (phase === "evaluating")
    return examChrome(embedded, home, (
        <div className="center-screen"><div className="card center" style={{ maxWidth: 420 }}>
          <Spinner />
          <h3 className="mt8">{t("evaluating")}</h3>
          <div className="muted small mt8">{stageTitle("evaluate", lang)}</div>
        </div></div>
    ));

  /* ---- Informed consent (research participation) ---- */
  if (boot.status === "consent" || (consent && consent.required && !consent.granted)) {
    const fa = lang === "fa";
    if (!consent) {
      return examChrome(embedded, home, (
        <div className="center-screen"><div className="card center" style={{ maxWidth: 420 }}>
          <Spinner />
          <div className="muted small mt8">{stageTitle("consent", lang)}</div>
        </div></div>
      ));
    }
    const text = fa ? (consent.consentTextFa || consent.consentTextEn) : (consent.consentTextEn || consent.consentTextFa);
    const withdrew = consent.reason === "consent_withdrawn";
    return examChrome(embedded, home, (
        <div className="center-screen">
          <div className="card" style={{ maxWidth: 620, textAlign: fa ? "right" : "left" }}>
            <h3><Icon name="shield" size={18} /> {fa ? "رضایت آگاهانهٔ پژوهشی" : "Informed research consent"}</h3>
            <div className="muted small mt4">{fa ? consent.titleFa : consent.titleEn}</div>
            <div className="row gap8 mt8 small" style={{ flexWrap: "wrap" }}>
              {consent.ethicsCode && <span className="tag">{fa ? "کد اخلاق" : "Ethics code"}: {consent.ethicsCode}</span>}
              {consent.protocolVersion && <span className="tag">{fa ? "نسخهٔ پروتکل" : "Protocol"}: {consent.protocolVersion}</span>}
            </div>
            {consent.reason === "consent_stale" && <div className="err-banner mt12">{fa
              ? "متن یا نسخهٔ رضایت‌نامه تغییر کرده است. رضایت قبلی برای ادامه کافی نیست؛ متن جدید را بخوانید و در صورت موافقت دوباره رضایت بدهید."
              : "The consent wording or protocol has changed. Review the new text and consent again if you agree."}</div>}
            {consent.reason === "research_paused" && <div className="err-banner mt12">{fa?"مشارکت به دستور ادمین متوقف است؛ ادامه فقط با رفع توقف توسط ادمین ممکن است.":"Participation is paused by an admin. Only an admin can lift this hold."}</div>}
            {withdrew && (
              <div className="err-banner mt12">
                {fa ? "شما پیش‌تر از این مطالعه انصراف داده‌اید. برای شرکت دوباره باید رضایت خود را ثبت کنید."
                    : "You previously withdrew from this study. To take part again you must give consent again."}
              </div>
            )}
            <div className="card mt12" style={{ background: "var(--panel2)", maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap" }}>
              {text || (fa ? "متن رضایت‌نامه هنوز توسط پژوهشگر ثبت نشده است. تا ثبت آن نمی‌توانید شرکت کنید."
                            : "The consent wording has not been recorded by the researcher yet. You cannot take part until it is.")}
            </div>
            <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={agreeConsent} disabled={consentBusy || !text || consent.reason === "research_paused"}>
                {fa ? "موافقم و شرکت می‌کنم" : "I agree and take part"}
              </button>
              <button className="btn btn-ghost" onClick={declineConsent} disabled={consentBusy}>
                {fa ? "خروج و ارسال درخواست به ادمین" : "Leave and send request to admin"}
              </button>
            </div>
            <div className="small muted mt8">
              {fa ? "درخواست انصراف برای ادمین ثبت می‌شود؛ توقف ثبت داده پس از دستور ادمین اعمال می‌شود. برای انصراف حضوری با مسئول مطالعه هماهنگ کنید."
                  : "Withdrawal requests are sent to the administrator; collection pauses after an admin decision. Contact the study coordinator for in-person withdrawal."}
            </div>
            {error && <div className="err-banner mt8">{error}</div>}
          </div>
        </div>
    ));
  }

  if (phase === "report")
    return <Report caseData={caseData} evalRes={evalRes} settings={settings}
      onBack={leaveExam} home={home} embedded={embedded} />;

  return examChrome(embedded, home, (
      <div className="container">
        <div className="section-title">
          <div>
            {isStaff
              ? (<>
                  <h2>{biField(caseData, "title", lang)}</h2>
                  <span className="small muted">{t("chief")}: {biField(caseData, "chief", lang)}</span>
                </>)
              : (<h2 className="vp-chief">{t("chief")}: <strong>{biField(caseData, "chief", lang)}</strong></h2>)}
            {/* The class's grading criterion, so the student knows what counts. */}
            {gradingScope !== "overall" && (
              <div className="mt4">
                <span className="tag" style={{ fontWeight: 800 }}>
                  <Icon name="target" size={13} /> {lang === "fa" ? "ملاک نمرهٔ این کلاس" : "This class is graded on"}:{" "}
                  {gradingScope === "extern"
                    ? (lang === "fa" ? "اکسترن — تا تشخیص افتراقی" : "extern — up to the differential dx")
                    : (lang === "fa" ? "اینترن — همه بخش‌ها" : "intern — all sections")}
                </span>
              </div>
            )}
          </div>
          <div style={{ textAlign: "end" }}>
            <div className="small muted">{t("examTimer")}</div>
            <div className="timer">{fmt(timeLeft ?? 0)}</div>
          </div>
        </div>
        {!!examId && antiCheat && leaves > 0 && (
          <div className="err-banner mb16"><Icon name="warn" size={16} /> {t("antiCheatWarn")} ({leaves})</div>
        )}
        {!!error && (
          <div className="err-banner mb16">
            <Icon name="warn" size={16} /> {error}
            <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 8 }} onClick={() => setError("")}>{t("close")}</button>
          </div>
        )}
        {loggingOn && (
          <div className="exam-log-banner mb16">
            <Icon name="warn" size={16} /> {t("loggingBanner")}
            <div className="small muted mt4">{t("loggingBannerHint")}</div>
          </div>
        )}
        <div className="exam-pane-switch" role="tablist" aria-label={lang === "fa" ? "نمای آزمون" : "Exam view"}>
          <button type="button" role="tab" aria-selected={pane === "chat"} className={pane === "chat" ? "active" : ""} onClick={() => setPane("chat")}>
            <Icon name="chat" size={16} /> {t("patientChat")}
          </button>
          <button type="button" role="tab" aria-selected={pane === "panel"} className={pane === "panel" ? "active" : ""} onClick={() => setPane("panel")}>
            <Icon name="list" size={16} /> {lang === "fa" ? "پرونده و اقدامات" : "Chart & actions"}
          </button>
        </div>
        <div className={`exam-layout pane-${pane}`}>
          <div className="card chat-box">
            <div style={{ fontWeight: 700, marginBottom: 8 }}><Icon name="chat" size={16} /> {t("patientChat")}</div>
            <div className="chat-msgs">
              {messages.length === 0 && !typing &&
                <div className="muted small center" style={{ margin: "auto" }}>{t("typeMessage")}</div>}
              {messages.map((m, i) => (
                m.role === "system" ? (
                  <div key={i} className="msg msg-lab" style={{ alignSelf: "center", background: "var(--panel2, #eef3f9)", border: "1px dashed var(--danger, #c44)", borderRadius: 12, maxWidth: "92%", textAlign: "start" }}>
                    <div className="small" style={{ fontWeight: 800, marginBottom: 4 }}>{stageTitle(m.stage, lang)}</div>
                    <div>{m.text}</div>
                  </div>
                ) : m.role === "lab" ? (
                  <div key={i} className="msg msg-lab" style={{ alignSelf: "center", background: "var(--panel2, #eef3f9)", border: "1px dashed var(--border)", borderRadius: 12, maxWidth: "92%", textAlign: "start" }}>
                    <div>{m.text}</div>
                    {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noreferrer"><img src={m.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 8, border: "1px solid var(--border)" }} /></a>}
                  </div>
                ) : (
                  <div key={i} className={`msg msg-${m.role === "student" ? "student" : (m.role === "teacher" || m.mode === "exam" ? "teacher" : "patient")}`}>
                    {(m.role === "teacher" || m.mode === "exam") && <div className="small" style={{ opacity: .7, marginBottom: 4, fontWeight: 700 }}>{t("teacherVoice")}</div>}
                    {m.text}
                    {/* Auscultation recording attached by the supervising
                        teacher (lung/heart) — click to listen. */}
                    {m.audio?.map((a, j) => (
                      <div key={j} style={{ marginTop: 8, padding: 10, borderRadius: 10,
                        background: "var(--bg2)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 6 }}>
                          <Icon name="volume" size={16} />
                          {lang === "fa" ? a.label_fa : a.label_en}
                        </div>
                        <audio controls src={a.url} preload="metadata" style={{ width: "100%", height: 36 }} />
                      </div>
                    ))}
                  </div>
                )
              ))}
              {typing && <div className="msg msg-patient msg-typing">{typingKind === "order"
                ? (lang === "fa" ? "در حال دریافت نتیجهٔ آزمایش/تصویر..." : "Fetching the lab / imaging result...")
                : t("aiThinking")}</div>}
              <div ref={chatEnd} />
            </div>
            <div className="chat-input">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={t("typeMessage")}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent?.isComposing && !e.repeat) send(); }} />
              <button className="btn btn-primary" onClick={send} disabled={typing}>{t("send")}</button>
            </div>
          </div>

          <div className="card side-panel">
            <div className="tabs">
              {/* Flow order per the station protocol: history → problem list →
                  differentials → THEN order tests/imaging from your ddx. */}
              {["history", "problem", "dx", "tests", "paraclinic", "imaging", "images"].map((id) => (
                <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => { setTab(id); logEvent("tab_switch", { tab: id }); }}>
                  {t(id === "history" ? "tabHistory" : id === "problem" ? "tabProblem"
                    : id === "tests" ? "tabTests" : id === "paraclinic" ? "tabParaclinic"
                    : id === "imaging" ? "tabImaging" : id === "images" ? "tabImages" : "tabDx")}
                  {id === "images" && requestedImages.length > 0 && <span className="tab-count">{requestedImages.length}</span>}
                </button>
              ))}
            </div>
            <div className="tab-content">
              {tab === "history" && <HistoryTab c={caseData} t={t} lang={lang} />}
              {tab === "problem" && <ProblemTab value={problemList} onChange={setProblemListSync} t={t} lang={lang} onBlurLog={(text) => { const lines = String(text||"").split(/\n/).map((s)=>s.trim()).filter(Boolean); if (lines.length) logEvent("problem_list", { lines: lines.length, text: lines.join("\n") }); }} />}
              {tab === "dx" && <DxTab ddx={ddx} setDdx={setDdxSync} finalDx={finalDx} setFinalDx={setFinalDxSync} t={t}
                onDdx={(x) => logEvent("ddx_add", { text: x })}
                onDdxRemove={(x) => logEvent("ddx_remove", { text: x })}
                onFinalDx={(x) => logEvent("final_dx", { text: x })} />}
              {tab === "tests" && <OrderTab label={t("orderTest")} listLabel={t("orderedTests")}
                catalog={orderCat.labs} items={tests} setItems={(v) => { const next = typeof v === "function" ? v(examSnapRef.current.tests || tests) : v; snapPatch({ tests: next }); setTests(next); }} lang={lang} t={t}
                onOrder={(q) => orderResult("lab", q)} />}
              {tab === "paraclinic" && <OrderTab label={t("orderParaclinic")} listLabel={t("orderedParaclinic")}
                catalog={mergeOrderCatalog(orderCat.paraclinic, orderCat.imaging)} items={paraclinic} setItems={(v) => { const next = typeof v === "function" ? v(examSnapRef.current.paraclinic || paraclinic) : v; snapPatch({ paraclinic: next }); setParaclinic(next); }} lang={lang} t={t}
                onOrder={(q) => orderResult("paraclinic", q)} />}
              {tab === "imaging" && <OrderTab label={t("orderImaging")} listLabel={t("orderedImaging")}
                catalog={mergeOrderCatalog(orderCat.imaging, orderCat.paraclinic)} items={imaging} setItems={(v) => { const next = typeof v === "function" ? v(examSnapRef.current.imaging || imaging) : v; snapPatch({ imaging: next }); setImaging(next); }} lang={lang} t={t}
                onOrder={(q) => orderResult("imaging", q)} />}
              {tab === "images" && <ImagesTab images={requestedImages} t={t} lang={lang} />}
            </div>
            <button className="btn btn-accent btn-block mt16" onClick={finish}>✓ {t("finishExam")}</button>
          </div>
        </div>
      </div>
  ));
}

/* Only the studies the student has actually ORDERED (and that came back with a
   picture) appear here — the tab is empty until then, so no image can hint at
   the diagnosis before the student asks for it. */
function ImagesTab({ images, t }) {
  const imgs = (images || []).filter((im) => im.url);
  if (!imgs.length) return <div className="small muted center" style={{ padding: 20 }}>{t("noImagesYet")}</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {imgs.map((im, i) => (
        <div key={i}>
          <a href={im.url} target="_blank" rel="noreferrer">
            <img src={im.url} alt="" loading="lazy" style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }} />
          </a>
          <div className="small muted mt8">{im.label || ""}</div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ c, t, lang }) {
  // The student must TAKE the history from the patient via the chat.
  // Only basic demographics are shown here (as observed on entering the room).
  const Row = ({ k, val }) => <div className="info-row"><span>{k}</span><span>{val}</span></div>;
  return (
    <>
      <label className="small muted">{t("patientCard")}</label>
      <Row k={t("age")} val={c.age} />
      <Row k={t("sex")} val={t(c.sex)} />
      <Row k={t("chief")} val={biField(c, "chief", lang)} />
      <div className="divider" />
      <div className="ddle-question" style={{ margin: 0 }}>
        <Icon name="chat" size={16} /> {t("takeHistoryNote")}
      </div>
      <div className="ddle-question mt8" style={{ margin: 0, borderInlineStartColor: "var(--gold)" }}>
        <Icon name="stethoscope" size={16} /> {t("examNote")}
      </div>
    </>
  );
}

/* Problem-list box: filled after the history & exam, BEFORE ordering tests.
   One problem per line. Externs are graded up to and including this box. */
function ProblemTab({ value, onChange, t, lang, onBlurLog }) {
  return (
    <>
      <div className="field">
        <label><Icon name="list" size={14} /> {t("problemList")}</label>
        <textarea
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlurLog?.(e.target.value)}
          placeholder={lang === "fa"
            ? "هر مسئله را در یک خط بنویسید، مثلاً:\n۱. درد قفسهٔ سینه فشارنده\n۲. دیابت نوع ۲\n۳. فشار خون بالا"
            : "One problem per line, e.g.:\n1. Crushing chest pain\n2. Type 2 diabetes\n3. Hypertension"}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: ".9rem",
            padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)" }} />
        <div className="small muted mt4">{t("problemListHint")}</div>
      </div>
    </>
  );
}

function OrderTab({ label, listLabel, catalog, items, setItems, lang, t, onOrder }) {
  const add = async (v) => {
    const val = orderLabel(v, lang);
    if (!val) return;
    // avoid duplicates (case-insensitive)
    if (items.some((x) => x.toLowerCase() === val.toLowerCase())) return;
    const r = await onOrder?.(val);
    if (!r?.ok) return;
    // The parent records successful orders before resolving onOrder, so Finish
    // cannot race this child callback and omit the last completed study.
  };
  return (
    <>
      <div className="field"><label>{label}</label>
        <OrderSearch catalog={catalog} lang={lang} onAdd={add} />
      </div>
      <label className="small muted">{listLabel}</label>
      <div>{items.length ? items.map((x, i) => (
        <span className="chip" key={i}>{x}<button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>✕</button></span>
      )) : <div className="small muted mt8">{t("noneYet")}</div>}</div>
    </>
  );
}

function DxTab({ ddx, setDdx, finalDx, setFinalDx, t, onDdx, onDdxRemove, onFinalDx }) {
  const [v, setV] = useState("");
  const add = () => {
    const text = v.trim();
    if (!text) return;
    setDdx((prev) => [...prev, text]);
    onDdx?.(text);
    setV("");
  };
  return (
    <>
      <div className="field"><label>{t("ddx")}</label>
        <div className="small muted">{t("ddxHint")}</div>
        <div className="inline-form" style={{ marginTop: 6 }}>
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("addDdx")}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent?.isComposing && !e.repeat) add(); }} />
          <button className="btn btn-primary btn-sm" onClick={add}>{t("add")}</button>
        </div>
        <div className="mt8">{ddx.map((x, i) => (
          <span className="chip" key={i}>{x}<button onClick={() => {
            const removed = x;
            setDdx((prev) => prev.filter((_, j) => j !== i));
            onDdxRemove?.(removed);
          }}>✕</button></span>
        ))}</div>
      </div>
      <div className="divider" />
      <div className="field"><label>{t("finalDx")}</label>
        <input value={finalDx} onChange={(e) => setFinalDx(e.target.value)}
          onBlur={(e) => onFinalDx?.(e.target.value)} placeholder={t("enterFinalDx")} />
      </div>
    </>
  );
}

function Report({ caseData, evalRes, settings, onBack, home, embedded = false }) {
  const { t, lang, user } = useApp();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const e = evalRes || {};
  const score = Number(e.score) || 0;
  const showAi = e.showAi != null ? !!e.showAi : settings.showAiAnalysis !== false;
  const showMicro = e.showMicro != null ? !!e.showMicro : settings.showMicro !== false;
  const List = ({ arr, fallback }) => arr && arr.length
    ? <ul className="list-clean">{arr.map((x, i) => <li key={i}>{x}</li>)}</ul>
    : <div className="small muted">{fallback || "-"}</div>;

  return examChrome(embedded, home, (
      <div className="container">
        <div className="section-title">
          <h2>{t("report")} — {isStaff ? biField(caseData, "title", lang) : biField(caseData, "chief", lang)}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>{t("backToCases")}</button>
        </div>
        {/* Top: Overall score and section breakdown */}
        <div className="grid grid-2">
          <div className="card center">
            <div className="score-ring" style={{ "--pct": `${score * 3.6}deg` }}><div className="val">{score}</div></div>
            <div className="lbl muted mt8">{t("finalScore")} / 100</div>
            <EvaluationProvenance evaluation={e} lang={lang} />
            {/* which criterion this final score was computed on */}
            {e.meta?.gradingScope === "extern" && (
              <div className="small muted mt4">{lang === "fa" ? "(ملاک اکسترن: تا تشخیص افتراقی)" : "(extern criterion: up to the differential dx)"}</div>
            )}
            {e.meta?.gradingScope === "intern" && (
              <div className="small muted mt4">{lang === "fa" ? "(ملاک اینترن: همه بخش‌ها)" : "(intern criterion: all sections)"}</div>
            )}
            <div className="tag mt8" style={{ fontWeight: 800 }}>{lang === "fa" ? "امتیاز از ۱۰" : "Score / 10"}: {e.score10 ?? Math.round(score / 10)}</div>
            {e.xpReward && (
              <div className="vp-xp-reward mt8" style={{ marginTop: 12 }}>
                {e.xpReward.awarded > 0 ? (
                  <div className="tag" style={{ background: "rgba(224,165,46,.16)", color: "var(--xp,#e0a52e)", border: "1px solid rgba(224,165,46,.4)", fontWeight: 800, fontSize: ".95rem", padding: "6px 12px" }}>
                    +{e.xpReward.awarded} XP {lang === "fa" ? "به رنکینگ" : "to ranking"}
                  </div>
                ) : (
                  <div className="small muted">
                    {lang === "fa"
                      ? `بهترین امتیاز قبلی‌ات ${e.xpReward.prevBest}٪ بود — این‌بار XP جدیدی اضافه نشد.`
                      : `Your previous best was ${e.xpReward.prevBest}% — no new XP this time.`}
                  </div>
                )}
                <div className="small muted mt8">{lang === "fa" ? `سقف XP این کیس: ${e.xpReward.xpMax}` : `Case XP cap: ${e.xpReward.xpMax}`}</div>
              </div>
            )}
          </div>

          {/* Section scores breakdown (Extern vs Intern criteria) */}
          {showAi && e.sectionScores && (() => {
            const ss = e.sectionScores;
            const scope = e.meta?.gradingScope || "overall";
            const externVal = ss.extern ?? ss.history;
            const isExtern = scope === "extern", isIntern = scope === "intern";
            const CriterionCard = ({ val, color, title, active }) => (
              <div className="card center" style={{ borderInlineStart: `4px solid ${color}`,
                boxShadow: active ? `0 0 0 2px ${color}` : undefined, padding: "10px 8px" }}>
                <div className="big" style={{ fontSize: "1.6rem" }}>{val != null ? val + "%" : "—"}</div>
                <div className="small muted" style={{ fontSize: ".76rem", marginTop: 4 }}>{title}</div>
                {active && <div className="tag mt4" style={{ fontWeight: 800 }}>{lang === "fa" ? "ملاک این کلاس" : "This class's criterion"}</div>}
              </div>
            );
            return (
              <div className="card">
                <h4 className="mb8"><Icon name="chart" size={16} /> {lang === "fa" ? "نمرهٔ تفکیکی بخش‌ها" : "Scores by section"}</h4>
                <div className="grid grid-2" style={{ gap: 8, marginBottom: 10 }}>
                  <CriterionCard val={externVal} color="var(--primary)"
                    title={lang === "fa" ? "ملاک اکسترن (شرح‌حال، معاینه، پرابلم لیست و ddx)" : "Extern (H&P, Problem list, DDx)"}
                    active={isExtern} />
                  <CriterionCard val={ss.intern ?? ss.overall} color="var(--green)"
                    title={lang === "fa" ? "ملاک اینترن (همه بخش‌ها + پاراکلینیک و درمان)" : "Intern (All sections + Workup & Rx)"}
                    active={isIntern} />
                </div>
                {/* detailed bar per section */}
                {ss.sections?.map((s) => (
                  <div className="check-item" key={s.key} style={{ alignItems: "center", padding: "4px 0" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: ".82rem" }}>{s.label} <span className="small muted">({s.items} {lang === "fa" ? "مورد" : "items"})</span></div>
                      <div className="pbar sm"><span style={{ width: `${s.score}%`, background: s.score >= 70 ? "var(--green)" : s.score < 40 ? "var(--danger)" : "var(--gold)" }} /></div>
                    </div>
                    <span className="tag" style={{ fontSize: ".75rem" }}>{s.score}%</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* PROMINENT MICROLEARNING: Positioned immediately below score and BEFORE checklist */}
        {showMicro && e.microlearning && (
          <div className="card mt16" style={{ borderInlineStart: "5px solid var(--primary, #0284c7)", background: "var(--panel, #ffffff)" }}>
            <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, color: "var(--primary, #0284c7)" }}>
              <Icon name="book" size={20} /> {t("microlearning")}
            </h3>
            <div className="micro-box" style={{ whiteSpace: "pre-line", padding: "16px 20px", lineHeight: 1.85, fontSize: "0.95rem" }}>
              <ClinicalLesson text={e.microlearning} />
            </div>
            <div className="small muted mt8">{t("microNote")}</div>
          </div>
        )}

        {/* CHECKLIST: Displayed after Microlearning */}
        <div className="card mt16">
          <h4 className="mb8"><Icon name="check" size={16} /> {t("checklist")}</h4>
          {showAi ? (e.results || []).map((r, i) => (
            <div className="check-item" key={r.id || i}>
              <div className={`status ${r.done ? "st-done" : "st-miss"}`}>{r.done ? "✓" : "✕"}</div>
              <div style={{ flex: 1 }}>
                {r.label}
                {/* per-item examiner reasoning from the LLM (OSCE scoring) */}
                {r.reason && <div className="small muted" style={{ marginTop: 2 }}>{r.reason}</div>}
              </div>
              <span className="tag">{t("weight")} {r.weight}</span>
            </div>
          )) : (
            <div className="small muted">{lang === "fa"
              ? "تحلیل موردی چک‌لیست برای این آزمون خاموش است."
              : "Item-level checklist analysis is off for this exam."}</div>
          )}
        </div>

        {/* Strengths & Weaknesses */}
        {showAi && (
          <>
            <div className="grid grid-2 mt16">
              <div className="card"><h4 style={{ color: "var(--ok)" }}><Icon name="strength" size={16} /> {t("strengths")}</h4><List arr={e.strengths} /></div>
              <div className="card"><h4 style={{ color: "var(--danger)" }}><Icon name="warn" size={16} /> {t("weaknesses")}</h4><List arr={e.weaknesses} /></div>
            </div>
            <div className="grid grid-2 mt16">
              <div className="card"><h4 style={{ color: "var(--warn)" }}><Icon name="pin" size={16} /> {t("missed")}</h4><List arr={e.missed} fallback="✓" /></div>
              <div className="card"><h4 style={{ color: "var(--warn)" }}><Icon name="repeat" size={16} /> {t("commonMistakes")}</h4><List arr={e.commonMistakes} /></div>
            </div>
            {e.suggestion && <div className="card mt16"><h4><Icon name="bulb" size={16} /> {t("suggestion")}</h4><div className="small mt8">{e.suggestion}</div></div>}
          </>
        )}
      </div>
  ));
}
