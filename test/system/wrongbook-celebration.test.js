import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';
import { onWrongBookGraded } from '../../src/render/contracts/wrongbook-flow.js';

/**
 * 系统级：错题本答错 → 进入 → 答对清完 → CLEARED + EXITED（庆祝前置条件）
 * 模拟 UI 契约路径，覆盖完整业务闭环。
 */
describe('系统：错题本清完触发庆祝前置事件', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('2 道错题：逐题答对（方案 B）→ CLEARED + EXITED + 进度全掌握', () => {
        createAndSwitchLibrary('系统错题库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'multi', question: 'q2', options: ['A', 'B', 'C'], answer: 'A,B', explanation: '' },
        ]);

        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, ['A', 'C']);
        assertEqual(LX.WrongBookAPI.count().data, 2);

        let cleared = null;
        let exited = false;
        LX.on(LX.Events.WRONGBOOK_CLEARED, (p) => { cleared = p; });
        LX.on(LX.Events.WRONGBOOK_EXITED, () => { exited = true; });

        assertOk(LX.WrongBookAPI.enter());

        const q1 = LX.QuestionAPI.get(1).data;
        const fin1 = onWrongBookGraded(LX, q1, LX.QuestionAPI.answer(q1, 'A'));
        assertTrue(fin1.mark.ok);
        assertTrue(!fin1.cleared, '还剩 1 题');

        const q2 = LX.QuestionAPI.get(2).data;
        const fin2 = onWrongBookGraded(LX, q2, LX.QuestionAPI.answer(q2, ['A', 'B']));
        assertTrue(fin2.cleared);
        assertTrue(cleared, '应 CLEARED');
        assertTrue(exited, '应 EXITED（庆祝页依赖）');
        assertEqual(LX.WrongBookAPI.count().data, 0);
        assertEqual(LX.ProgressAPI.getStatus(q1).data, 'mastered');
        assertEqual(LX.ProgressAPI.getStatus(q2).data, 'mastered');
    });
}, { layer: 'system', tags: ['wrongbook', 'e2e'] });
