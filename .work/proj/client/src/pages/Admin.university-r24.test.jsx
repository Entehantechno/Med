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

it('retry uses server-provided logical CSV records without splitting quoted multiline fields',async()=>{
 const failedCsv='name,student_no\n"Rejected\nName",2002';
 api.post.mockResolvedValue({created:1,skipped:1,total:2,hasHeader:true,failedCsv,failures:[{line:3,sno:'2002',reason_en:'full'}],duplicates:[]});
 render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByRole('button',{name:'importStudents'}));const modal=within(screen.getByRole('dialog'));const text=modal.getByRole('textbox');
 fireEvent.change(text,{target:{value:'name,student_no\nAccepted,1001\n"Rejected\nName",2002'}});fireEvent.click(modal.getByRole('button',{name:'Import'}));fireEvent.click(await modal.findByRole('button',{name:'Keep failed only'}));expect(text.value).toBe(failedCsv);
});
