import {it,expect} from 'vitest';
import {adminTabMode} from './admin-navigation.js';
const groups={general:[['research'],['settings']],uni:[['research'],['classes']],learn:[['cards']]};
it('keeps a shared research tab in the university area',()=>expect(adminTabMode('research','uni',groups)).toBe('uni'));
it('keeps a shared research tab in the general area',()=>expect(adminTabMode('research','general',groups)).toBe('general'));
it('still navigates across areas for an exclusive tab',()=>expect(adminTabMode('classes','general',groups)).toBe('uni'));
it('does not select an area for an inaccessible tab',()=>expect(adminTabMode('hidden','uni',groups)).toBeNull());
