import React from 'react';
import {render,screen,fireEvent,waitFor,within,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../api.js',()=>({api,getToken:()=>'.'+btoa(JSON.stringify({role:'admin'}))+'.'}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:'admin'}})}));
vi.mock('../components/UI.jsx',()=>({TopBar:()=>null,Spinner:()=>null,Pill:()=>null,Modal:({children})=><div role="dialog">{children}</div>,useToast:()=>()=>{}}));
import {UsersManager} from './Admin.jsx';
beforeEach(()=>{vi.clearAllMocks();api.get.mockImplementation(async path=>{
 if(path==='/universities')return {universities:[{id:22,name_en:'R22 university',name_fa:'دانشگاه',code:'UNI-R22'}]};
 if(path.startsWith('/admin/users?'))return {users:[{id:2,name_en:'R22 student',role:'student',university_id:22,status:'active'}]};
 if(path==='/classes'||path==='/cases')return [];
 throw Error('Unknown API route: '+path);
});});afterEach(cleanup);

for(const blankLines of [false,true])it(`keep failed only retains rejected rather than accepted CSV records (blank lines=${blankLines})`,async()=>{
 api.post.mockResolvedValue({created:1,skipped:2,total:3,enrolled:0,hasHeader:true,delim:',',failures:[{line:3,sno:'2002',reason_en:'full'},{line:4,sno:'3003',reason_en:'full'}],duplicates:[]});
 render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByRole('button',{name:'importStudents'}));const modal=within(screen.getByRole('dialog'));const text=modal.getByRole('textbox');
 const lines=['name,student_no','Accepted,1001','Rejected,2002','Rejected,3003'];
 fireEvent.change(text,{target:{value:lines.join(blankLines?'\n\n':'\n')}});fireEvent.click(modal.getByRole('button',{name:'Import'}));
 fireEvent.click(await modal.findByRole('button',{name:'Keep failed only'}));expect(text.value).toBe('name,student_no\nRejected,2002\nRejected,3003');
});
