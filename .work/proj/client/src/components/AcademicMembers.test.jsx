import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('../api.js',()=>({api}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{role:'admin'}})}));
import AcademicMembers from './AcademicMembers.jsx';
import {Modal} from './UI.jsx';
beforeEach(()=>{vi.clearAllMocks();api.put.mockResolvedValue({ok:true});api.get.mockImplementation(async url=>({items:new URL('http://test'+url).searchParams.get('page')==='2'?[{id:2,name_en:'Second',student_no:'9002',status:'active',member:0}]:[{id:1,name_en:'First',student_no:'9001',status:'active',member:0}],total:51}));});
afterEach(cleanup);
it('one cancel and one save remain outside the scrollable body; selection survives paging',async()=>{
 const saved=vi.fn();render(<AcademicMembers kind="classes" id={8} onClose={()=>{}} onSaved={saved}/>);
 await screen.findByText(/First/);await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));await screen.findByText(/Second/);await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());fireEvent.click(screen.getByRole('checkbox'));
 expect(screen.getAllByRole('button',{name:'cancel'})).toHaveLength(1);const save=screen.getByRole('button',{name:'Save',exact:true});expect(save.closest('.modal-body')).toBeNull();expect(save.closest('.modal-actions')).not.toBeNull();fireEvent.click(save);
 await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(api.put).toHaveBeenCalledWith('/academic/groups/classes/8/members',{addIds:[1,2],removeIds:[]});
});
it('failed save keeps draft and a retry does not need reselection',async()=>{
 api.put.mockRejectedValueOnce(new Error('disk unavailable')).mockResolvedValue({ok:true});const saved=vi.fn();render(<AcademicMembers kind="exams" id={9} onClose={()=>{}} onSaved={saved}/>);
 await screen.findByText(/First/);await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}));await screen.findByRole('alert');expect(screen.getByRole('checkbox')).toBeChecked();expect(saved).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Save',exact:true})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(api.put.mock.calls[1][1]).toEqual({addIds:[1],removeIds:[]});
});
it('stale search result cannot replace a newer directory response',async()=>{
 let first;api.get.mockImplementationOnce(()=>new Promise(resolve=>first=resolve)).mockResolvedValue({items:[{id:3,name_en:'New result',status:'active',member:0}],total:1});
 render(<AcademicMembers kind="classes" id={8} onClose={()=>{}} onSaved={()=>{}}/>);await waitFor(()=>expect(api.get).toHaveBeenCalledOnce());fireEvent.change(screen.getByLabelText('Search students'),{target:{value:'New'}});await screen.findByText(/New result/);first({items:[{id:4,name_en:'Stale result',status:'active',member:0}],total:1});await waitFor(()=>expect(screen.queryByText(/Stale result/)).not.toBeInTheDocument());
});
it('modal catches async failure, blocks duplicate submission and closing while pending',async()=>{
 let reject;const close=vi.fn(),save=vi.fn(()=>new Promise((_,r)=>reject=r));render(<Modal title="Test" onClose={close} onSave={save}><input aria-label="draft" defaultValue="preserved"/></Modal>);
 fireEvent.click(screen.getByRole('button',{name:'save'}));fireEvent.click(screen.getByRole('button',{name:'save'}));fireEvent.keyDown(window,{key:'Escape'});expect(save).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();reject(new Error('Write failed'));await screen.findByRole('alert');await waitFor(()=>expect(screen.getByRole('alert')).toHaveFocus());expect(screen.getByLabelText('draft')).toHaveValue('preserved');
});
it('select all filtered traverses server pages, not only the displayed page',async()=>{
 api.get.mockImplementation(async url=>{const q=new URL('http://test'+url).searchParams;const page=Number(q.get('page')),size=Number(q.get('pageSize'));return {total:130,items:Array.from({length:Math.min(size,130-(page-1)*size)},(_,n)=>({id:(page-1)*size+n+1,name_en:'Student '+((page-1)*size+n),status:'active',member:0}))}});
 const saved=vi.fn();render(<AcademicMembers kind="classes" id={8} onClose={()=>{}} onSaved={saved}/>);await screen.findByText(/Student 0/);await waitFor(()=>expect(screen.getByRole('button',{name:'Select all active filtered results'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Select all active filtered results'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('130 unsaved changes'));fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(api.put.mock.calls[0][1].addIds).toHaveLength(130);expect(api.put.mock.calls[0][1].addIds).toContain(130);
});
