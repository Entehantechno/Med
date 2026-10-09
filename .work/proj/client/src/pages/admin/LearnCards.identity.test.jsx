import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import LearnCards from './LearnCards.jsx';
vi.mock('../../context.jsx',()=>({useApp:()=>({lang:'en',t:k=>k})}));
vi.mock('../../components/UI.jsx',async importOriginal=>({...await importOriginal(),useToast:()=>vi.fn()}));
vi.mock('../../api.js',()=>({api:{get:vi.fn(async url=>url.includes('/learn-cards')?{cards:[{id:1,public_code:'Q-test-code',q:'Example question',active:1,type:'mcq',usedIn:[],facets:{},difficulty:'easy'}],subjects:[],categories:[],facets:{}}:{count:0})}}));
it('renders the bank with permanent code and explicit status',async()=>{
 render(<LearnCards/>);
 expect(await screen.findByText('Q-test-code')).toBeTruthy();
 expect(screen.getByText('Example question')).toBeTruthy();
 expect(screen.getByLabelText('Select all on page')).toBeTruthy();
});
