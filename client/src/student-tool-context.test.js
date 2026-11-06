/* R95: the student's Dr Tutor and questionnaire context must be a consistent pair.
   The type must come with the id of that type (exam -> examId, class -> classId), and a
   list page with nothing selected is "general". The old code sent "exam" with a classId and
   "class"/"exam" with a null id; the server refused those with a 403 on every list visit.
   This reads the source (App.jsx is too large to render here). The behaviour was also
   checked in the browser: the student walk has 0 4xx after the fix (see the R95 report). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8');

describe('R95 student tool context in App.jsx', () => {
  it('an exam route with an examId is the exam context', () => {
    expect(app).toMatch(/isExam && route\.examId \? \{ contextType: "exam", contextId: route\.examId \}/);
  });
  it('a class-based exam route is the class context, never exam with a class id', () => {
    expect(app).toMatch(/isExam && route\.classId \? \{ contextType: "class", contextId: route\.classId \}/);
  });
  it('everything else is the general context', () => {
    expect(app).toMatch(/: \{ contextType: "general", contextId: null \};/);
  });
  it('the old mismatched expressions are gone', () => {
    expect(app).not.toMatch(/route\.name === "exams" \? "exam"/);
    expect(app).not.toMatch(/route\.name === "classes" \? "class"/);
    expect(app).not.toMatch(/route\.examId \|\| route\.classId \|\| null/);
  });
});
