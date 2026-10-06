import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('../api.js',()=>({api:mocks,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{role:'admin'},can:()=>true})}));
import {CaseModal,CardModal} from './Admin.jsx';
import {CardModalInner} from './admin/LearnCards.jsx';
beforeEach(()=>{vi.clearAllMocks();mocks.get.mockResolvedValue([]);mocks.post.mockResolvedValue({ok:true});mocks.put.mockResolvedValue({ok:true});});
afterEach(cleanup);
it('keeps the clinical input mounted while typing and preserves both languages across sections',async()=>{
 render(<CaseModal caseObj={{}} onClose={()=>{}} onSave={vi.fn()}/>);
 const field=screen.getByLabelText('caseTitle (EN)');field.focus();fireEvent.change(field,{target:{value:'English title'}});expect(document.activeElement).toBe(field);
 fireEvent.click(screen.getByRole('button',{name:'فارسی',exact:true}));const persian=screen.getByLabelText('caseTitle (FA)');fireEvent.change(persian,{target:{value:'عنوان فارسی'}});
 fireEvent.click(screen.getByRole('button',{name:/History & examination/}));fireEvent.click(screen.getByRole('button',{name:/Basics & complaint/}));
 fireEvent.click(screen.getByRole('button',{name:'Both',exact:true}));expect(field.value).toBe('English title');expect(persian.value).toBe('عنوان فارسی');
});
it.each(['mcq','truefalse','fill','match','order','compare','hotspot','drawing','kf','puzzle','stepwise'])('renders the %s authoring flow and review without crashing',async type=>{
 render(<CardModal card={{type,title_en:'Title'}} onClose={()=>{}} onSave={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Show all'}));expect(screen.getByRole('button',{name:'Save content'})).toBeTruthy();
});
it('saves independent English lesson, explanation and matching-pair values',async()=>{
 render(<CardModalInner card={{id:42,difficulty:'medium',data:{type:'match',q_fa:'فارسی',q_en:'English',pairs:[['چپ','left','راست','right']],micro:{lead_fa:'درس',lead_en:'lesson'},explain:{text_fa:'پاسخ',text_en:'answer'},mnemonic:{scene_fa:'صحنه',scene_en:'scene'}}}} onClose={()=>{}} onSaved={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Save content'}));await waitFor(()=>expect(mocks.put).toHaveBeenCalled());
 const body=mocks.put.mock.calls[0][1];expect(body.pairs).toEqual([['چپ','left','راست','right']]);expect(body.micro.lead_en).toBe('lesson');expect(body.explain.text_en).toBe('answer');expect(body.mnemonic.scene_en).toBe('scene');
});
it('retains the editor and announces failed saves',async()=>{
 mocks.put.mockRejectedValue(new Error('Connection failed'));
 render(<CardModalInner card={{id:42,data:{q_fa:'سؤال',q_en:'Question',options:[{fa:'الف',en:'a',correct:true},{fa:'ب',en:'b',correct:false}]}}} onClose={()=>{}} onSaved={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Save content'}));expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');expect(screen.getByRole('dialog')).toBeTruthy();
});
it('preserves English-only academic pairs and existing lesson points when saving',async()=>{
 const save=vi.fn();
 render(<CardModal card={{type:'match',title_en:'Match',pairs:[['','left','','right']],micro:{lead_en:'Lesson',points_en:['Keep this'],options_fa:['Keep rationale']}}} onClose={()=>{}} onSave={save}/>);
 fireEvent.click(screen.getByRole('button',{name:'Save content'}));await waitFor(()=>expect(save).toHaveBeenCalled());const body=save.mock.calls[0][0];expect(body.pairs).toEqual([['','left','','right']]);expect(body.micro.points_en).toEqual(['Keep this']);expect(body.micro.options_fa).toEqual(['Keep rationale']);
});
it.each([
 ['English-only',[],['first','second'],['',''],['first','second']],
 ['mixed gaps',['الف','','ج'],['A','B','C'],['الف','','ج'],['A','B','C']]
])('preserves %s academic ordering rows on save',async(_,fa,en,wantFa,wantEn)=>{
 const save=vi.fn();render(<CardModal card={{type:'order',title_en:'Order',items_fa:fa,items_en:en}} onClose={()=>{}} onSave={save}/>);
 fireEvent.click(screen.getByText('Save content'));await waitFor(()=>expect(save).toHaveBeenCalled());expect(save.mock.calls[0][0].items_fa).toEqual(wantFa);expect(save.mock.calls[0][0].items_en).toEqual(wantEn);
});
it('does not copy comparison translations into intentionally empty fields',async()=>{
 const save=vi.fn(),features=[{fa:'',en:'English only',belongs:'A'},{fa:'فقط فارسی',en:'',belongs:'B'}];
 render(<CardModal card={{type:'compare',title_en:'Compare',entityA_en:'A',entityB_en:'B',features}} onClose={()=>{}} onSave={save}/>);
 fireEvent.click(screen.getByText('Save content'));await waitFor(()=>expect(save).toHaveBeenCalled());expect(save.mock.calls[0][0].features).toEqual(features);
});
it('parses Persian commas and newlines in academic accepted answers',async()=>{
 const save=vi.fn();render(<CardModal card={{type:'fill',title_fa:'سؤال',accept_fa:'الف، ب\nج',accept_en:'A, B\nC'}} onClose={()=>{}} onSave={save}/>);
 fireEvent.click(screen.getByText('Save content'));await waitFor(()=>expect(save).toHaveBeenCalled());expect(save.mock.calls[0][0].accept_fa).toEqual(['الف','ب','ج']);expect(save.mock.calls[0][0].accept_en).toEqual(['A','B','C']);
});
it('renders and edits existing English-only ordering rows without Persian placeholders',async()=>{
 const save=vi.fn();render(<CardModal card={{type:'order',title_en:'Order',items_fa:[],items_en:['first','second']}} onClose={()=>{}} onSave={save}/>);
 fireEvent.click(screen.getByText('Show all'));fireEvent.change(screen.getByDisplayValue('first'),{target:{value:'edited'}});fireEvent.click(screen.getByText('Save content'));
 await waitFor(()=>expect(save).toHaveBeenCalled());expect(save.mock.calls[0][0].items_en).toEqual(['edited','second']);
});
