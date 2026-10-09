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
it('user management loads universities from the real mounted API route',async()=>{render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByRole('combobox',{name:'University'}));expect(await screen.findByRole('option',{name:/R22 university.*UNI-R22/})).toBeTruthy();expect(api.get).toHaveBeenCalledWith('/universities');expect(api.get).not.toHaveBeenCalledWith('/admin/universities');});
it('student import offers universities returned by the mounted API route',async()=>{render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByRole('button',{name:'importStudents'}));fireEvent.click(await within(screen.getByRole('dialog')).findByRole('combobox',{name:'University'}));expect(await within(screen.getByRole('dialog')).findByRole('option',{name:/R22 university/})).toBeTruthy();await waitFor(()=>expect(api.get.mock.calls.filter(([path])=>path==='/universities')).toHaveLength(2));});
