import React,{useState} from 'react';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k})}));
import AuthoringModal from './AuthoringModal.jsx';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function Editor({onClose,onSave=()=>{}}){const [value,setValue]=useState({count:0});return <AuthoringModal title="Test" value={value} onClose={onClose} onSave={onSave} sections={[{id:'one',title:'One'}]}><button onClick={()=>setValue({count:value.count+1})}>Add item</button></AuthoringModal>;}
it('warns on button-driven edits, not only native input changes',()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false),close=vi.fn();render(<Editor onClose={close}/>);
 fireEvent.click(screen.getByText('Add item'));fireEvent.click(screen.getByText('cancel'));
 expect(confirm).toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
});
it('does not warn after navigation without edits',()=>{
 const confirm=vi.spyOn(window,'confirm'),close=vi.fn();render(<Editor onClose={close}/>);
 fireEvent.click(screen.getByText('Both'));fireEvent.click(screen.getByText('Show all'));fireEvent.click(screen.getByText('cancel'));
 expect(confirm).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
});
it('blocks duplicate saves and closing until a pending request settles',async()=>{
 let reject;const save=vi.fn(()=>new Promise((_,r)=>{reject=r;})),close=vi.fn();render(<Editor onClose={close} onSave={save}/>);
 fireEvent.click(screen.getByText('Save content'));fireEvent.click(screen.getByText('Saving…'));fireEvent.click(screen.getByText('cancel'));fireEvent.keyDown(window,{key:'Escape'});
 expect(save).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();reject(new Error('Offline'));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Offline'));expect(screen.getByText('Save content')).not.toBeDisabled();
});
it('retains the input-event warning while asynchronous values have not reached the parent yet',()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false),close=vi.fn();render(<AuthoringModal value={{}} title="Pending" sections={[{id:'one',title:'One'}]} onClose={close}><input aria-label="Pending text"/></AuthoringModal>);
 fireEvent.change(screen.getByLabelText('Pending text'),{target:{value:'Pending'}});fireEvent.click(screen.getByText('cancel'));expect(confirm).toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
});
it('disables content editing while saving and re-enables it on failure',async()=>{
 let reject;render(<AuthoringModal value={{}} title="Pending" sections={[{id:'one',title:'One'}]} onClose={()=>{}} onSave={()=>new Promise((_,r)=>{reject=r;})}><input aria-label="Content"/><button>Add row</button></AuthoringModal>);
 fireEvent.click(screen.getByText('Save content'));expect(screen.getByLabelText('Content')).toBeDisabled();expect(screen.getByText('Add row')).toBeDisabled();reject(new Error('Offline'));await screen.findByRole('alert');expect(screen.getByLabelText('Content')).not.toBeDisabled();
});
