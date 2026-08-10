import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 串联 SAR；单点 SAR 见 unit/ui/matrix。
 * 用户流程 3：错题循环
 * 答错入错题 → 进入专注模式 → 全部掌握 → 自动退出 + 庆祝事件
 */
describe('集成：错题循环', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('答错入错题 → 专注模式 → 全部掌握 → 自动退出 + 庆祝', () => {
        // 1. 创建题库，5 道单选题
        const r = LX.LibraryAPI.create('错题循环库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'single', question: 'q2', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 3, type: 'single', question: 'q3', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);

        // 2. 答错全部 3 题
        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, 'B');
        LX.QuestionAPI.answer(3, 'B');
        assertEqual(LX.WrongBookAPI.count().data, 3);

        // 3. 进入专注模式
        const enterR = LX.WrongBookAPI.enter();
        assertOk(enterR);
        assertEqual(enterR.data.wrongCount, 3);

        // navigation 应只见 3 道错题
        assertEqual(LX.NavigationAPI.current().data.total, 3);

        // 4. 监听庆祝事件
        let celebration = null;
        LX.on(LX.Events.WRONGBOOK_CLEARED, (p) => {
            celebration = p;
        });

        // 5. 逐题标记掌握
        const r1 = LX.WrongBookAPI.markMastered(1);
        assertFalse(r1.data.cleared, '还剩 2 题');
        const r2 = LX.WrongBookAPI.markMastered(2);
        assertFalse(r2.data.cleared, '还剩 1 题');
        const r3 = LX.WrongBookAPI.markMastered(3);
        assertTrue(r3.data.cleared, '最后一题应 cleared');

        // 6. 验证庆祝事件 + 自动退出
        assertTrue(celebration, '应触发 WRONGBOOK_CLEARED 事件');
        assertEqual(celebration.libId, r.data.id);

        // 退出后 navigation 恢复全量
        assertEqual(LX.NavigationAPI.current().data.total, 3, '退出错题模式后应见全部 3 题');

        // 错题数应为 0
        assertEqual(LX.WrongBookAPI.count().data, 0);
    });
});
