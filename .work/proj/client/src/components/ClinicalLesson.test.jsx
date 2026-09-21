import {render,screen,cleanup} from '@testing-library/react';
import {describe,it,expect,afterEach} from 'vitest';
import ClinicalLesson,{EvaluationProvenance} from './ClinicalLesson.jsx';
afterEach(cleanup);
describe('safe clinical lesson display',()=>{
 it('renders headings, lists and emphasis without literal markers',()=>{
  const {container}=render(<ClinicalLesson text={'### تمرین\n- **زمان شروع** را بپرسید\n- پاسخ را ثبت کنید\n1. خودآزمایی'}/>);
  expect(screen.getByRole('heading',{name:'تمرین'})).toBeTruthy();
  expect(container.querySelectorAll('li')).toHaveLength(3);
  expect(container.querySelector('strong').textContent).toBe('زمان شروع');
  expect(container.textContent).not.toContain('**');
 });
 it('never executes model-provided HTML or creates remote images/links',()=>{
  const {container}=render(<ClinicalLesson text={'<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[link](javascript:alert(1))'}/>);
  expect(container.querySelector('script,img,a')).toBeNull();
  expect(container.textContent).toContain('<script>');
 });
 it('renders only text lessons, not arbitrary model objects',()=>{
  const {container}=render(<ClinicalLesson text={{bad:'shape'}}/>);expect(container.innerHTML).toBe('');
 });
 it('distinguishes AI teaching from fallback scoring without exposing raw provider errors',()=>{
  render(<EvaluationProvenance lang="en" evaluation={{source:'mock',feedbackSource:'llm',scoreFallback:{error:'PRIVATE PROVIDER DETAILS'}}}/>);
  expect(screen.getByText(/Rule-based checklist/)).toBeTruthy();expect(screen.getByText(/Model-generated/)).toBeTruthy();
  expect(screen.getByText(/fallback score is shown/)).toBeTruthy();expect(screen.queryByText(/PRIVATE/)).toBeNull();
 });
});
