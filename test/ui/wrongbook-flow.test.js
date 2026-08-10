import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';
import {
    markMasteredInWrongBook,
    onWrongBookGraded,
} from '../../src/render/contracts/wrongbook-flow.js';

/**
 * UI ↔ API 契约：错题本方案 B
 * 不渲染完整页面，直接测契约模块（页面 wrongbook.js 必须调用这些函数）
 */
describe('UI 契约：错题本方案 B（wrongbook-flow）', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('答对后 onWrongBookGraded → markMastered，末题 cleared', () => {
        createAndSwitchLibrary('契约库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        LX.QuestionAPI.answer(1, 'B');
        assertOk(LX.WrongBookAPI.enter());

        const q = LX.QuestionAPI.get(1).data;
        const ans = LX.QuestionAPI.answer(q, 'A');
        assertTrue(ans.data.correct);

        let cleared = false;
        LX.on(LX.Events.WRONGBOOK_CLEARED, () => { cleared = true; });

        const fin = onWrongBookGraded(LX, q, ans);
        assertOk(fin.mark);
        assertTrue(fin.cleared);
        assertTrue(cleared);
        assertEqual(LX.WrongBookAPI.count().data, 0);
    });

    it('答错不调用 markMastered', () => {
        createAndSwitchLibrary('契约库2', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        LX.QuestionAPI.answer(1, 'B');
        LX.WrongBookAPI.enter();
        const q = LX.QuestionAPI.get(1).data;
        const ans = LX.QuestionAPI.answer(q, 'B');
        assertFalse(ans.data.correct);

        const fin = onWrongBookGraded(LX, q, ans);
        assertEqual(fin.mark, null);
        assertFalse(fin.cleared);
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'review');
    });

    it('markMasteredInWrongBook 非错题本模式返回 NOT_IN_WRONG_BOOK', () => {
        createAndSwitchLibrary('契约库3', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        const r = markMasteredInWrongBook(LX, 1);
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'NOT_IN_WRONG_BOOK');
    });
}, { layer: 'ui', tags: ['contract', 'wrongbook'] });
