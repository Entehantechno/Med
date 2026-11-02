import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('../api.js',()=>({api,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:'admin'}})}));
import {Dashboard} from './Admin.jsx';

const summary=(over={})=>({students:3,cases:2,cards:5,exams:1,attempts:4,avgScore:72,
  byType:{vp:3,flash:1},buckets:[1,1,1,1],trend:[60,70,80,90],
  recent:[{id:1,student_fa:'الف',student_en:'Ali',case_fa:'ک',case_en:'Case A',score:90,created_at:'2026-11-01T10:00:00Z'}],...over});

beforeEach(()=>{vi.clearAllMocks();});
afterEach(()=>{cleanup();});

it('loads everything from one summary request (no full attempts list)',async()=>{
  api.get.mockResolvedValue(summary());
  render(<Dashboard/>);
  await screen.findByText('Ali — Case A');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/reports/summary');
  expect(api.get.mock.calls.some(([p])=>String(p).includes('/reports/attempts'))).toBe(false);
});

it('labels the trend as the last 12 attempts, matching what it plots',async()=>{
  api.get.mockResolvedValue(summary());
  render(<Dashboard/>);
  expect(await screen.findByText('Last 12 attempts')).toBeTruthy();
});

it('shows honest empty states when there is too little data',async()=>{
  api.get.mockResolvedValue(summary({trend:[80],recent:[]}));
  render(<Dashboard/>);
  expect(await screen.findByText('Not enough attempts to draw the trend yet.')).toBeTruthy();
  expect(screen.getByText('No activity recorded yet.')).toBeTruthy();
});

it('surfaces a load failure instead of an endless spinner',async()=>{
  api.get.mockRejectedValue(new Error('boom'));
  render(<Dashboard/>);
  expect(await screen.findByText('boom')).toBeTruthy();
});
