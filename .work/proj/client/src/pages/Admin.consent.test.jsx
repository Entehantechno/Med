import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const state=vi.hoisted(()=>({role:'admin'}));
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('../api.js',()=>({api,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:state.role}})}));
import {ResearchAdmin} from './Admin.jsx';
beforeEach(()=>{
 state.role='admin';vi.clearAllMocks();vi.spyOn(window,'confirm').mockReturnValue(true);
 api.get.mockImplementation(async path=>path==='/research/studies'?{studies:[{id:12,title_fa:'Test study',consent_admin_managed:true,consent_required:true}]}:path.endsWith('/consents')?{study:{titleEn:'Test study',consentModes:['paper','verbal']},counts:{total:0,byMode:{}},consents:[],participationControls:[]}:{});
 api.post.mockResolvedValue({ok:true});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('defaults to admin-managed consent and sends that policy on save',async()=>{
 render(<ResearchAdmin/>);
 const flag=await screen.findByLabelText('Admin-managed consent — no website confirmation required');expect(flag.checked).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'save',exact:true}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/research/studies',expect.objectContaining({consent_admin_managed:true,consent_modes:['online','paper','verbal']})));
});
it('lets admin apply an explicit pause and resume with participant ID and note',async()=>{
 render(<ResearchAdmin/>);fireEvent.click(await screen.findByRole('button',{name:'Consents',exact:true}));
 const uid=await screen.findByLabelText('User ID');fireEvent.change(uid,{target:{value:'8'}});
 fireEvent.change(screen.getByLabelText('Required note (e.g. in-person withdrawal)'),{target:{value:'Paper withdrawal 12'}});
 fireEvent.click(screen.getByRole('button',{name:'Apply decision'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/research/studies/12/participation',{user_id:8,blocked:true,note:'Paper withdrawal 12'}));
 fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'false'}});
 fireEvent.click(screen.getByRole('button',{name:'Apply decision'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/research/studies/12/participation',{user_id:8,blocked:false,note:'Paper withdrawal 12'}));
});
it('does not expose admin policy or participation controls to a teacher',async()=>{
 state.role='teacher';render(<ResearchAdmin/>);
 expect((await screen.findByLabelText('Admin-managed consent — no website confirmation required')).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Consents',exact:true}));
 await screen.findByRole('button',{name:'Record paper/verbal consent'});
 expect(screen.queryByRole('button',{name:'Apply decision'})).toBeNull();
});
