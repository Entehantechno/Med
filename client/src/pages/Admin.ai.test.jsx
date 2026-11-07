import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(()=>({get:vi.fn(),put:vi.fn(),post:vi.fn()}));
vi.mock('../api.js',()=>({api:mocks,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:key=>key})}));
vi.mock('../components/UI.jsx',()=>({TopBar:()=>null,Spinner:()=>null,Pill:()=>null,Modal:()=>null,useToast:()=>()=>{}}));
import { AiConfig, VpatientAiConfig } from './Admin.jsx';
const settings={provider:'OpenRouter',model:'vendor/legacy',apiKey:'synthetic',routingEnabled:true,routes:[{id:'a',label:'first',enabled:true,provider:'OpenRouter',model:'vendor/free:free',apiKey:'synthetic',cooldownSeconds:60}]};
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.get.mockImplementation(async path=>path.includes('ai-providers')?[]:path.includes('/admin/')?{config:structuredClone(settings)}:structuredClone(settings));
 mocks.put.mockResolvedValue({config:structuredClone(settings)});
 mocks.post.mockResolvedValue({connected:true,sample:'Old tested answer',model:'old-model'});
});
afterEach(cleanup);
describe.each([['university',AiConfig,'Test virtual patient with API'],['competitive',VpatientAiConfig,'Test with API']])('%s AI settings',(_name,Component,testButton)=>{
 it('invalidates the old successful test after an edit',async()=>{
  render(<Component/>);await screen.findByLabelText('Connection name');
  fireEvent.click(screen.getByRole('button',{name:testButton,exact:true}));
  await screen.findByText(/Old tested answer/);
  fireEvent.change(screen.getByLabelText('Connection name'),{target:{value:'changed'}});
  expect(screen.queryByText(/Old tested answer/)).toBeNull();
  expect(screen.queryByText(/● connectionOk/)).toBeNull();
 });
 it('locks edits and saves while a test is pending to prevent stale-result races',async()=>{
  let finish;mocks.post.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  render(<Component/>);await screen.findByLabelText('Connection name');
  fireEvent.click(screen.getByRole('button',{name:testButton,exact:true}));
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Connection name')).toBeDisabled();
  expect(screen.getByRole('button',{name:'save',exact:true})).toBeDisabled();
  finish({connected:true,sample:'Finished'});
  await screen.findByText(/Finished/);
  expect(screen.getByLabelText('Connection name')).not.toBeDisabled();
 });
});
