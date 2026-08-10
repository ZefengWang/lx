import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 串联 SAR；单点 SAR 见 unit/ui/matrix。
 * 用户流程 1：完整学习流程
 * 导入题库 → 答题（5 种题型）→ 标记掌握/错题 → 验证统计正确
 */
describe('集成：完整学习流程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('导入 → 答题（5 题型）→ 进度统计正确', () => {
        // 1. 导入题库（5 种题型各 1 题）
        const r = LX.IOAPI.importLibrary('学习题库', [
            { id: 1, type: 'single', question: '单选', options: ['A', 'B', 'C', 'D'], answer: 'B', explanation: '' },
            { id: 2, type: 'multi', question: '多选', options: ['A', 'B', 'C', 'D'], answer: 'A,C', explanation: '' },
            { id: 3, type: 'judge', question: '判断', options: [], answer: '对', explanation: '' },
            { id: 4, type: 'fill', question: '填空____', options: [], answer: '北京', explanation: '' },
            { id: 5, type: 'essay', question: '简答', options: [], answer: '', explanation: '解析', answerText: '参考' },
        ]);
        assertOk(r);
        LX.LibraryAPI.switch(r.data.id);

        // 2. 答题（答对 1、3；答错 2、4；简答 5）
        const r1 = LX.QuestionAPI.answer(1, 'B');
        assertTrue(r1.data.correct);

        const r2 = LX.QuestionAPI.answer(2, 'A');
        assertFalse(r2.data.correct, '漏选 C 应错');

        const r3 = LX.QuestionAPI.answer(3, '对');
        assertTrue(r3.data.correct);

        const r4 = LX.QuestionAPI.answer(4, '错误答案');
        assertFalse(r4.data.correct);

        const r5 = LX.QuestionAPI.answer(5, '用户答案');
        assertFalse(r5.data.correct, '简答不自动判分');

        // 3. 验证统计
        const stats = LX.StatsAPI.summary().data;
        assertEqual(stats.total, 5);
        assertEqual(stats.mastered, 2, '答对 2 题（1、3）');
        assertEqual(stats.review, 3, '错题 3 题（2、4、5）');
        assertEqual(stats.percent, 40, '2/5 = 40%');
    });
});
