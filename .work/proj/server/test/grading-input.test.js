import {it,expect} from 'vitest';
import {gradeFlashcard} from '../src/lib/flashcard-grade.js';
const examples=[
 ['mcq',{id:1,type:'mcq',options:[{en:'A',correct:true},{en:'B',correct:false}]},v=>({optionIndex:v})],
 ['kf',{id:2,type:'kf',kf:{items:[{kind:'mcq',correct:0,options_en:['A','B']}]}},v=>({answers:{0:v}})],
 ['hotspot',{id:3,type:'hotspot',hotspot:{x:0,y:0,r:5}},v=>({x:v,y:v})],
 ['match',{id:4,type:'match',pairs:[['a','a','b','b']]},v=>({pairs:{0:v}})],
 ['order',{id:5,type:'order',items_en:['first','second']},v=>({lang:'en',order:[v,1]})],
 ['puzzle',{id:6,type:'puzzle',puzzle:{pins:[{label_en:'A',x:0,y:0}]}},v=>({assign:{0:v}})]
];
for(const [name,card,body] of examples){
 it.each([null,'','  ',false,[],[0]])(`${name}: empty/non-scalar %j is not answer zero`,v=>{expect(gradeFlashcard(card,body(v),{allowLegacy:true}).ok).toBe(false);});
 it(`${name}: explicit numeric zero remains valid`,()=>{expect(gradeFlashcard(card,body(0),{allowLegacy:true}).ok).toBe(true);});
}
it.each([-1,101,Infinity])('rejects hotspot coordinate outside the image: %s',x=>{expect(gradeFlashcard(examples[2][1],{x,y:0}).ok).toBe(false);});
it('accepts each alternate-language fill synonym, not the comma-joined array',()=>{
 const card={id:7,type:'fill',accept_en:['alpha','beta']};expect(gradeFlashcard(card,{lang:'fa',text:'beta'}).ok).toBe(true);expect(gradeFlashcard(card,{lang:'fa',text:'alpha,beta'}).ok).toBe(false);
});
it('accepts alternate-language short KF synonyms independently',()=>{
 const card={id:8,type:'kf',kf:{items:[{kind:'short',accept_en:['alpha','beta']}]}};expect(gradeFlashcard(card,{lang:'fa',answers:{0:'beta'}}).ok).toBe(true);
});
