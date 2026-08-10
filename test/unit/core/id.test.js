import { describe, it, beforeEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { genLibId, genQId, resetQIdCounter } from '../../../src/core/id.js';

describe('core/id', () => {
    beforeEach(() => {
        resetQIdCounter();
    });

    it('S=默认 A=genLibId → R=lib_ 前缀且两次不相等', () => {
        const a = genLibId();
        const b = genLibId();
        assertTrue(a.startsWith('lib_'));
        assertTrue(b.startsWith('lib_'));
        assertTrue(a !== b);
    });

    it('S=计数器归零 A=genQId 连续 → R=1,2,3', () => {
        assertEqual(genQId(), 1);
        assertEqual(genQId(), 2);
        assertEqual(genQId(), 3);
    });

    it('S=已自增 A=resetQIdCounter → R=再次从 1', () => {
        genQId();
        genQId();
        resetQIdCounter();
        assertEqual(genQId(), 1);
    });
}, { layer: 'core', tags: ['id', 'sar'] });
