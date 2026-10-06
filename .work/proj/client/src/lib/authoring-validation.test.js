import {it,expect} from 'vitest';
import {validateQuestion} from './authoring-validation.js';
it.each(['mcq','fill','match','order','compare','hotspot','puzzle','kf','stepwise'])('rejects incomplete %s before saving',type=>{expect(validateQuestion({type,title_en:'Title'},'en')).toBeTruthy();});
it('accepts explicit independent-language MCQ options',()=>{expect(validateQuestion({type:'mcq',title_en:'Question',options:[{en:'A',correct:true},{en:'B',correct:false}]},'en')).toBeNull();});

it('does not force a guessed key onto an explicitly keyless legacy question',()=>{expect(validateQuestion({type:'mcq',q_en:'Legacy',source_meta:{keyless:true,key_available:false},options:[{en:'A'},{en:'B'}]},'en')).toBeNull();});
