import React, { useState } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import AiRoutesEditor from './AiRoutesEditor.jsx';
afterEach(cleanup);
const rows=[{id:'a',label:'Free first',model:'vendor/a:free',provider:'OpenRouter',enabled:true,apiKey:'synthetic'}, {id:'b',label:'Paid second',model:'vendor/b',provider:'OpenRouter',enabled:false}];
function Harness({initial={routingEnabled:true,routes:rows}}){const[cfg,setCfg]=useState(initial);return <><AiRoutesEditor cfg={cfg} onChange={setCfg} providers={[{key:'OpenRouter'}]} fa={false}/><output data-testid="config">{JSON.stringify(cfg)}</output></>;}
const cfg=()=>JSON.parse(screen.getByTestId('config').textContent);
describe('AI priority editor',()=>{
 it('reorders, enables and removes connections without mixing their keys',()=>{
  render(<Harness/>);fireEvent.click(screen.getByLabelText('Move up 2'));expect(cfg().routes.map(r=>r.id)).toEqual(['b','a']);
  const first=screen.getAllByRole('group')[0];fireEvent.click(within(first).getByLabelText('Enabled (charges may apply)'));expect(cfg().routes[0].enabled).toBe(true);
  fireEvent.click(within(first).getByText('Remove row'));expect(cfg().routes[0].apiKey).toBe('synthetic');
 });
 it('adds disabled routes and explicitly clears individual keys',()=>{
  render(<Harness/>);fireEvent.click(screen.getByText('Add connection (max 8)'));expect(cfg().routes[2].enabled).toBe(false);
  fireEvent.click(screen.getAllByText('Clear this row’s key')[0]);expect(cfg().routes[0].apiKey).toBe('');expect(cfg().routes[0].clearApiKey).toBe(true);
 });
 it('clears the old credential when the endpoint changes and permits explicit re-entry',()=>{
  render(<Harness/>);
  const first=screen.getAllByRole('group')[0];
  fireEvent.change(within(first).getByLabelText('Base URL'),{target:{value:'https://other.example/v1'}});
  expect(cfg().routes[0].apiKey).toBe('');expect(cfg().routes[0].clearApiKey).toBe(true);
  fireEvent.change(within(first).getByLabelText('API key'),{target:{value:'replacement'}});
  expect(cfg().routes[0].apiKey).toBe('replacement');expect(cfg().routes[0].clearApiKey).toBe(false);
 });
 it('toggles routing without destroying stored connections',()=>{
  render(<Harness/>);fireEvent.click(screen.getByLabelText('Use ordered model / API connections'));expect(cfg().routingEnabled).toBe(false);expect(cfg().routes).toHaveLength(2);expect(screen.queryByText('Add connection (max 8)')).toBeNull();
 });
});
