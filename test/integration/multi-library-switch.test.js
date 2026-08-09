import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 用户流程 5：多题库切换
 * 创建 3 题库 → 各自做题 → 切换 → 各题库进度独立
 */
describe('集成：多题库切换进度独立', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('3 题库各自做题 → 切换 → 进度独立保留', () => {
        // 1. 创建 3 个题库
        const r1 = LX.LibraryAPI.create('题库A', [
            { id: 1, type: 'single', question: 'A1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        const r2 = LX.LibraryAPI.create('题库B', [
            { id: 1, type: 'single', question: 'B1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        const r3 = LX.LibraryAPI.create('题库C', [
            { id: 1, type: 'single', question: 'C1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        const idA = r1.data.id;
        const idB = r2.data.id;
        const idC = r3.data.id;

        // 2. 题库A：标记掌握
        LX.LibraryAPI.switch(idA);
        const qA = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(qA, 'mastered', { libId: idA, questions: [qA] });
        assertEqual(LX.StatsAPI.summary().data.mastered, 1, '题库A 应有 1 道掌握');

        // 3. 题库B：标记错题
        LX.LibraryAPI.switch(idB);
        const qB = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(qB, 'review', { libId: idB, questions: [qB] });
        assertEqual(LX.StatsAPI.summary().data.review, 1, '题库B 应有 1 道错题');
        assertEqual(LX.StatsAPI.summary().data.mastered, 0, '题库B 应无掌握');

        // 4. 题库C：不做题
        LX.LibraryAPI.switch(idC);
        assertEqual(LX.StatsAPI.summary().data.mastered, 0, '题库C 应无掌握');
        assertEqual(LX.StatsAPI.summary().data.review, 0, '题库C 应无错题');

        // 5. 切回题库A，验证进度仍保留
        LX.LibraryAPI.switch(idA);
        assertEqual(LX.StatsAPI.summary().data.mastered, 1, '切回题库A 掌握数应保留');
        assertEqual(LX.StatsAPI.summary().data.review, 0, '题库A 应无错题');

        // 6. 切回题库B，验证进度仍保留
        LX.LibraryAPI.switch(idB);
        assertEqual(LX.StatsAPI.summary().data.review, 1, '切回题库B 错题数应保留');
        assertEqual(LX.StatsAPI.summary().data.mastered, 0, '题库B 应无掌握');
    });
});
