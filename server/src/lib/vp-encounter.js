import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Faculty-authored content only: never put learner conversation/events here.
export function sealEncounter({caseData,checklist,gradingScope,gradingRubric}) {
 const body={schema_version:1,caseData,checklist,gradingScope,gradingRubric};
 return JSON.stringify({...body,sha256:hash(body)});
}
export function readEncounter(session) {
 if(!session?.encounter_snapshot_json)throw new Error('encounter_snapshot_missing');
 let parsed;
 try{parsed=JSON.parse(session.encounter_snapshot_json);}catch{throw new Error('encounter_snapshot_invalid');}
 const {sha256,...body}=parsed||{};
 if(body.schema_version!==1||sha256!==hash(body)||Number(body.caseData?.id)!==Number(session.case_id)||!Array.isArray(body.checklist?.items)||!['overall','extern','intern'].includes(body.gradingScope)||!body.gradingRubric||typeof body.gradingRubric!=='object')throw new Error('encounter_snapshot_invalid');
 return body;
}
