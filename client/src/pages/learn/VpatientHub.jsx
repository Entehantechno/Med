/* VpatientHub.jsx — the learner's virtual-patient entry point inside LearnApp.

   Before R87 no learner-facing screen mounted CaseList or Exam: the learner shell
   had no route for them, so the virtual patient was unreachable for competitive
   learners. This hub keeps the two screens in one tab:
     • the case list (CaseList, learner mode: /learn/vpatient, topic filter, daily case);
     • an exam view (Exam) when a case is started. Leaving it returns to the list.
   `onOpenCards({key,label})` jumps from a case to the flashcards of its subject. */
import { useState } from "react";
import CaseList from "../CaseList.jsx";
import Exam from "../Exam.jsx";

export default function VpatientHub({ home, topic = null, onOpenCards }) {
  const [caseId, setCaseId] = useState(null);

  // Exam and CaseList both navigate with go(name, params). Only "exam" and the list matter here.
  const go = (name, params = {}) => {
    if (name === "exam" && params.caseId) setCaseId(params.caseId);
    else setCaseId(null);
  };

  if (caseId) {
    return <Exam caseId={caseId} go={go} home={() => setCaseId(null)} />;
  }
  return <CaseList go={go} home={home} initialTopic={topic} onOpenCards={onOpenCards} />;
}
