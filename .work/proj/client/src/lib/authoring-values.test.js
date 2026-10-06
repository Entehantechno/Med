import {it,expect} from 'vitest';
import {acceptedAnswers,orderingRows} from './authoring-values.js';
it('keeps literal punctuation inside already stored array entries',()=>{expect(acceptedAnswers(['A, B',' ج، د ',''])).toEqual(['A, B','ج، د']);});
it('drops only jointly empty ordering rows and retains aligned translations',()=>{expect(orderingRows(['الف','','','د'],['A','','C'])).toEqual({items_fa:['الف','','د'],items_en:['A','C','']});});
it('does not mutate original ordering arrays',()=>{const fa=Object.freeze(['الف','']),en=Object.freeze(['','B']);expect(orderingRows(fa,en)).toEqual({items_fa:['الف',''],items_en:['','B']});});
