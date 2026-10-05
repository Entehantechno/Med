import Emphasis from './Emphasis.jsx';

// Small, text-only markdown subset. Never interpret model HTML, links, images
// or scripts. React escapes all text; no dangerouslySetInnerHTML path exists.
export default function ClinicalLesson({text}) {
  if(typeof text!=='string' || !text.trim()) return null;
  const blocks=[]; let list=[],ordered=false;
  const flush=()=>{
    if(!list.length)return;
    const Tag=ordered?'ol':'ul';
    blocks.push(<Tag key={`list-${blocks.length}`} style={{paddingInlineStart:24}}>{list.map((line,i)=><li key={i}><Emphasis text={line}/></li>)}</Tag>);
    list=[];
  };
  for(const line of text.split(/\r?\n/)) {
    const heading=line.match(/^\s*#{1,6}\s+(.+)$/);
    const bullet=line.match(/^\s*([-*]|\d+[.)]|[۰-۹]+[.)])\s+(.+)$/);
    if(bullet){const nextOrdered=!/^[-*]$/.test(bullet[1]);if(list.length && ordered!==nextOrdered)flush();ordered=nextOrdered;list.push(bullet[2]);continue;}
    flush();
    if(heading)blocks.push(<h4 key={blocks.length} style={{marginBlock:'1em .5em'}}><Emphasis text={heading[1]}/></h4>);
    else if(line.trim())blocks.push(<p key={blocks.length} style={{marginBlock:'.45em'}}><Emphasis text={line}/></p>);
  }
  flush();return <section className="clinical-lesson" dir="auto">{blocks}</section>;
}

export function EvaluationProvenance({evaluation={},lang='fa'}) {
  const fa=lang==='fa';
  const scoring=evaluation.meta?.scoredBy || evaluation.source || 'mock';
  const teaching=evaluation.meta?.feedbackBy || evaluation.feedbackSource || 'mock';
  return <div className="small muted mt8" role="status">
    <div>{fa?'روش نمره‌دهی: ':'Scoring: '}{scoring==='llm'?(fa?'ارزیاب هوش مصنوعی':'AI examiner'):(fa?'چک‌لیست قاعده‌محور (نه ارزیابی مدل)':'Rule-based checklist (not model grading)')}</div>
    <div>{fa?'روش درسنامه: ':'Lesson: '}{teaching==='llm'?(fa?'تولید مدل؛ نیازمند بررسی علمی':'Model-generated; requires clinical review'):(fa?'تمرین هدفمند قاعده‌محور':'Rule-based targeted practice')}</div>
    {(evaluation.scoreFallback || evaluation.meta?.scoreFallback) && <div>{fa?'ارزیابی مدل معتبر دریافت نشد؛ نمرهٔ جایگزین نمایش داده شده است.':'No valid model assessment was received; the fallback score is shown.'}</div>}
    {(evaluation.feedbackFallback || evaluation.meta?.feedbackFallback) && <div>{fa?'درسنامهٔ معتبر از مدل دریافت نشد؛ نسخهٔ جایگزین نمایش داده شده است.':'No valid model lesson was received; fallback teaching is shown.'}</div>}
  </div>;
}
