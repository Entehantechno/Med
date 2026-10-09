import {it,expect} from 'vitest';
import {acceptedAnswers,orderingRows} from './authoring-values.js';
it('keeps literal punctuation inside already stored array entries',()=>{expect(acceptedAnswers(['A, B',' ج، د ',''])).toEqual(['A, B','ج، د']);});
it('drops only jointly empty ordering rows and retains aligned translations',()=>{expect(orderingRows(['الف','','','د'],['A','','C'])).toEqual({items_fa:['الف','','د'],items_en:['A','C','']});});
it('does not mutate original ordering arrays',()=>{const fa=Object.freeze(['الف','']),en=Object.freeze(['','B']);expect(orderingRows(fa,en)).toEqual({items_fa:['الف',''],items_en:['','B']});});
it('preserves zero and clamps only finite coordinates',async()=>{
 const {percentCoordinate}=await import('./authoring-values.js');expect(percentCoordinate(0)).toBe(0);expect(percentCoordinate('0')).toBe(0);expect(percentCoordinate(undefined)).toBe(50);expect(percentCoordinate('bad')).toBe(50);expect(percentCoordinate(-1)).toBe(0);expect(percentCoordinate(101)).toBe(100);
});
