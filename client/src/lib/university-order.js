export const universitySearchText=v=>String(v??'').normalize('NFKC').toLocaleLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[\u200c\s]+/g,' ').trim();
export function universityName(u,lang='fa'){return (lang==='en'?u.name_en:u.name_fa)||u.name_fa||u.name_en||u.name||u.code||String(u.id);}
export function sortUniversities(rows,lang='fa'){
 const compare=new Intl.Collator(lang==='en'?'en':'fa',{sensitivity:'base',numeric:true}).compare;
 return [...(rows||[])].sort((a,b)=>compare(universitySearchText(universityName(a,lang)),universitySearchText(universityName(b,lang)))||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
}
export function matchesUniversity(u,query){return universitySearchText(query).split(' ').filter(Boolean).every(word=>universitySearchText([u.name_fa,u.name_en,u.name,u.code,u.city_fa,u.city_en].join(' ')).includes(word));}
