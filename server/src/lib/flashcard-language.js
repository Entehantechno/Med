// Read-time only. Never overwrite authored translations or apply this to VP charts.
const present=v=>typeof v==='string'?!!v.trim():Array.isArray(v)?v.some(present):v!=null;
export function flashcardLanguageFallback(value){
 if(Array.isArray(value))return value.map(flashcardLanguageFallback);
 if(!value||typeof value!=='object')return value;
 const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,flashcardLanguageFallback(v)]));
 const pairs=new Map([['fa','en'],['l','le'],['r','re']]);
 for(const k of Object.keys(out))if(k.endsWith('_fa')||k.endsWith('_en')){const base=k.slice(0,-3);pairs.set(base+'_fa',base+'_en')}
 for(const [fa,en]of pairs){
  if(!(fa in out)&&!(en in out))continue;
  const a=out[fa],b=out[en];
  if(Array.isArray(a)&&Array.isArray(b)){
   out[fa]=Array.from({length:Math.max(a.length,b.length)},(_,i)=>present(a[i])?a[i]:b[i]);
   out[en]=Array.from({length:Math.max(a.length,b.length)},(_,i)=>present(b[i])?b[i]:a[i]);
  }else{
   if(!present(a)&&present(b))out[fa]=b;
   if(!present(b)&&present(a))out[en]=a;
  }
 }
 if(Array.isArray(out.pairs))out.pairs=out.pairs.map(p=>Array.isArray(p)?[present(p[0])?p[0]:p[1],present(p[1])?p[1]:p[0],present(p[2])?p[2]:p[3],present(p[3])?p[3]:p[2]]:p&&typeof p==='object'?[p.l,p.le,p.r,p.re]:p);
 return out;
}
