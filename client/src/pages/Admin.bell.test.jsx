import React from 'react';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
const who=vi.hoisted(()=>({role:'teacher'}));
vi.mock('../api.js',()=>({api,getToken:()=>''}));
vi.mock('../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k,user:{id:1,role:who.role}})}));
import {AdminBell} from './Admin.jsx';

beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue({notifications:[],unseen:0});});
afterEach(()=>{cleanup();});

// Regression (R94): teachers got a 403 from /admin/notifications on every poll.
it('does not load or render the admin bell for a teacher',async()=>{
  who.role='teacher';
  const {container}=render(<AdminBell/>);
  await new Promise((r)=>setTimeout(r,0));
  expect(api.get.mock.calls.some(([p])=>String(p).includes('/admin/notifications'))).toBe(false);
  expect(container.innerHTML).toBe('');
});

it('loads notifications for a full admin',async()=>{
  who.role='admin';
  render(<AdminBell/>);
  await waitFor(()=>expect(api.get).toHaveBeenCalledWith('/admin/notifications'));
  expect(screen.getByTitle('adminNotifs')).toBeTruthy();
});
