import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

describe('系统：练习模式旅程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('快速：答对推进；prev 回看；next 回进度', () => {
        createAndSwitchLibrary('旅程库', [
            { id: 1, type: 'single', question: 'T1', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 2, type: 'single', question: 'T2', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 3, type: 'single', question: 'T3', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        assertOk(LX.DrillAPI.start({ mode: 'quick', count: 3 }));
        const first = LX.DrillAPI.current().data.qId;
        const q = LX.QuestionAPI.get(first).data;
        const ans = LX.QuestionAPI.answer(q, 'A');
        assertOk(ans);
        LX.DrillAPI.recordAnswer(first, { userAnswer: 'A', correct: true, correctAnswer: 'A' });
        assertOk(LX.DrillAPI.advanceProgress());
        const second = LX.DrillAPI.current().data.qId;
        assertTrue(second !== first);

        assertOk(LX.DrillAPI.prev());
        assertEqual(LX.DrillAPI.current().data.qId, first);
        assertEqual(LX.DrillAPI.current().data.answer.userAnswer, 'A');

        assertOk(LX.DrillAPI.next());
        assertEqual(LX.DrillAPI.current().data.qId, second);
        LX.DrillAPI.exit();
        assertEqual(LX.DrillAPI.isActive(), false);
    });

    it('背诵：afterAnswer 不推进', () => {
        createAndSwitchLibrary('背诵旅程', [
            { id: 1, type: 'single', question: 'M1', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 2, type: 'single', question: 'M2', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        assertOk(LX.DrillAPI.start({ mode: 'memory', count: 2 }));
        const id = LX.DrillAPI.current().data.qId;
        LX.DrillAPI.recordAnswer(id, { userAnswer: 'A', correct: true });
        const ar = LX.DrillAPI.afterAnswer({ correct: true });
        assertOk(ar);
        assertEqual(ar.data.advanced, false);
        assertEqual(LX.DrillAPI.current().data.qId, id);
        LX.DrillAPI.exit();
    });
}, { layer: 'system', tags: ['drill', 'e2e'] });
