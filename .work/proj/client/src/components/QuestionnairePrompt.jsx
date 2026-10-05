import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import QuestionnaireForm from "./QuestionnaireForm.jsx";

/* Prompts the student for any questionnaire that applies to the current
   context, then renders the real instrument (scales, checklist, NPS) instead
   of the old single "ثبت" button that recorded nothing. */
export default function QuestionnairePrompt({ contextType = "general", contextId = null }) {
  const { lang } = useApp();
  const [forms, setForms] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () =>
    api.get(`/questionnaires/prompts?contextType=${contextType}&contextId=${contextId || ""}`)
       .then((d) => setForms(d.forms || []))
       .catch(() => {});

  useEffect(() => { load(); }, [contextType, contextId]);

  if (!open && !forms.length) return null;
  const current = open || forms[0];
  if (!current) return null;

  return (
    <div className="card questionnaire-prompt mb16">
      <QuestionnaireForm
        form={current}
        lang={lang}
        contextType={contextType}
        contextId={contextId}
        onCancel={() => { setOpen(null); setForms((f) => f.slice(1)); }}
        onDone={() => { setOpen(null); setForms((f) => f.slice(1)); }}
      />
    </div>
  );
}
