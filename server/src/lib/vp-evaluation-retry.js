import {createHash} from 'node:crypto';
// Short-lived process memory only, NOT draft/autosave or a database record.
// No raw transcript or credentials retained; fingerprint binds all grading inputs.
// Exact owned session + unchanged inputs only. Access is checked by the route.
const entries=new Map();
const TTL=2*60*1000, MAX=64;
export const evaluationFingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function retryScoreGet(sessionId,userId,fingerprint){
 const key=`${userId}:${sessionId}`,row=entries.get(key);
 if(!row)return null;
 if(row.expires<=Date.now()||row.fingerprint!==fingerprint){entries.delete(key);return null;}
 return structuredClone(row.value);
}
export function retryScorePut(sessionId,userId,fingerprint,value){
 if(!sessionId||value?.result?.source!=='llm'||value.result.scoreFallback)return;
 for(const [key,row] of entries)if(row.expires<=Date.now())entries.delete(key);
 const key=`${userId}:${sessionId}`;entries.delete(key);
 if(entries.size>=MAX)entries.delete(entries.keys().next().value);
 entries.set(key,{fingerprint,value:structuredClone(value),expires:Date.now()+TTL});
 // Physically expire even on an idle server; do not extend TTL on reads.
 const saved=entries.get(key);
 const timer=setTimeout(()=>{if(entries.get(key)===saved)entries.delete(key);},TTL);
 timer.unref?.();
}
export function retryScoreDrop(sessionId,userId){entries.delete(`${userId}:${sessionId}`);}
