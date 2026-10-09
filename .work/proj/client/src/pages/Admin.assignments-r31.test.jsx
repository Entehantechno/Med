import React from 'react';
import {render,screen,fireEvent,within,cleanup,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
const toast=vi.hoisted(()=>vi.fn());
vi.mock('../api.js',()=>({api,getToken:()=>'.'+btoa(JSON.stringify({role:'admin'}))+'.'}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:'admin'}})}));
vi.mock('../components/UI.jsx',async original=>({...await original(),useToast:()=>toast}));
import {UsersManager} from './Admin.jsx';
beforeEach(()=>{vi.resetAllMocks();api.get.mockImplementation(async path=>{
 if(path==='/universities')return {universities:[{id:1,name_en:'University'}]};
 if(path.startsWith('/admin/users?'))return {users:[{id:2,name_en:'Student',student_no:'R31',role:'student',university_id:1,status:'active',caseIds:[1]}]};
 if(path==='/classes')return [];
 if(path==='/cases')return [{id:1,title_en:'Case one',version:1}];
 throw Error('Unknown route '+path);
});});
afterEach(cleanup);
async function open(){render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByTitle('manageAccess'));return within(screen.getByRole('dialog'));}
it('invalid fractional quota is explained without submitting',async()=>{api.put.mockResolvedValue({ok:true});const modal=await open();fireEvent.change(modal.getByRole('spinbutton'),{target:{value:'1.5'}});fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));expect(api.put).not.toHaveBeenCalled();expect(await modal.findByRole('alert')).toHaveTextContent('positive whole number');});
it('pending replacement locks controls and suppresses duplicate saves',async()=>{api.put.mockReturnValue(new Promise(()=>{}));const modal=await open();const save=modal.getByRole('button',{name:'saveAccess'});fireEvent.click(save);fireEvent.click(save);expect(api.put).toHaveBeenCalledTimes(1);expect(save).toBeDisabled();expect(modal.getByRole('checkbox')).toBeDisabled();expect(modal.getByRole('spinbutton')).toBeDisabled();fireEvent.click(modal.getByRole('button',{name:'cancel'}));expect(screen.getByRole('dialog')).toBeInTheDocument();});
it('failed save is visible, keeps selection, and permits a successful retry',async()=>{api.put.mockRejectedValueOnce(Object.assign(Error('Disk unavailable'),{status:503})).mockResolvedValueOnce({ok:true});const modal=await open();fireEvent.change(modal.getByRole('spinbutton'),{target:{value:'5'}});fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));expect(await modal.findByRole('alert')).toHaveTextContent('Disk unavailable');expect(modal.getByRole('checkbox')).toBeChecked();expect(modal.getByRole('spinbutton')).toHaveValue(5);expect(toast).not.toHaveBeenCalled();fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(api.put).toHaveBeenLastCalledWith('/assignments/2',{caseIds:[1],maxAttempts:5});expect(toast).toHaveBeenCalledWith('saved');});
for(const value of ['', '-1'])it(`rejects empty/negative quota ${JSON.stringify(value)}`,async()=>{const modal=await open();fireEvent.change(modal.getByRole('spinbutton'),{target:{value}});fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));expect(api.put).not.toHaveBeenCalled();expect(await modal.findByRole('alert')).toHaveTextContent('positive whole number');});
it('explicitly unchecking every case sends a valid empty replacement',async()=>{api.put.mockResolvedValue({ok:true});const modal=await open();fireEvent.click(modal.getByRole('checkbox'));fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(api.put).toHaveBeenCalledWith('/assignments/2',{caseIds:[],maxAttempts:3});});
it('oversized selection is explained before submitting',async()=>{const get=api.get.getMockImplementation();api.get.mockImplementation(path=>path.startsWith('/admin/users?')?Promise.resolve({users:[{id:2,name_en:'Student',role:'student',university_id:1,status:'active',caseIds:Array.from({length:401},(_,i)=>i+1)}]}):get(path));const modal=await open();fireEvent.click(modal.getByRole('button',{name:'saveAccess'}));expect(api.put).not.toHaveBeenCalled();expect(await modal.findByRole('alert')).toHaveTextContent('at most 400');});
