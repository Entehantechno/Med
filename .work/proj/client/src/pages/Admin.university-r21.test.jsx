import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../api.js',()=>({api,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:'admin'}})}));
vi.mock('../components/UI.jsx',()=>({TopBar:()=>null,Spinner:()=>null,Pill:()=>null,Modal:()=>null,useToast:()=>()=>{}}));
import {UsersManager} from './Admin.jsx';
const classes=[{id:12,name_en:'R21 class',code:'MED-R21'}];
let classResponse;
beforeEach(()=>{
 vi.clearAllMocks();classResponse=classes;
 api.get.mockImplementation(async path=>path.startsWith('/admin/users?')?{users:[{id:2,username:'s21',name_en:'R21 student',role:'student',university_id:1,status:'active'}]}:path==='/classes'?classResponse:path==='/admin/universities'?{universities:[]}:[]);
 api.post.mockResolvedValue({added:[2]});
});
afterEach(cleanup);
async function open(){render(<UsersManager scope="uni"/>);fireEvent.click(await screen.findByRole('checkbox',{name:'Select row 1'}));fireEvent.click(screen.getByRole('button',{name:'Add to class'}));}
it('offers the API array of classes and submits the selected class ID',async()=>{
 await open();const option=await screen.findByRole('option',{name:/R21 class/});fireEvent.change(option.parentElement,{target:{value:'12'}});fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/admin/users/bulk-assign-class',{ids:[2],class_id:12}));
});
it('accepts the legacy wrapped list of classes',async()=>{
 classResponse={classes};await open();expect(await screen.findByRole('option',{name:/R21 class/})).toBeTruthy();
});
it('handles a null class-list payload as an empty list without crashing',async()=>{
 classResponse=null;await open();expect(screen.queryByRole('option',{name:/R21 class/})).toBeNull();
});
