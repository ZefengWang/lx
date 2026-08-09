import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 用户流程 6：分类合并
 * 题目分散 2 分类 → rename 合并 → 验证题目数累加
 */
describe('集成：分类合并', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('分类合并库', [
            { id: 1, type: 'essay', question: 'q1', category: '教育学', answer: '', explanation: '' },
            { id: 2, type: 'essay', question: 'q2', category: '教育学', answer: '', explanation: '' },
            { id: 3, type: 'essay', question: 'q3', category: '心理学', answer: '', explanation: '' },
            { id: 4, type: 'essay', question: 'q4', category: '心理学', answer: '', explanation: '' },
            { id: 5, type: 'essay', question: 'q5', category: '心理学', answer: '', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);
    });

    it('题目分散 2 分类 → rename 合并 → 题目数累加', () => {
        // 初始：教育学 2 题，心理学 3 题
        const before = LX.CategoryAPI.list().data;
        assertEqual(before.find((c) => c.name === '教育学').count, 2);
        assertEqual(before.find((c) => c.name === '心理学').count, 3);
        assertEqual(before.length, 2);

        // rename 心理学 → 教育学（合并）
        const r = LX.CategoryAPI.rename('心理学', '教育学');
        assertOk(r);
        assertEqual(r.data.changedCount, 3, '应修改 3 题');

        // 验证合并后
        const after = LX.CategoryAPI.list().data;
        assertEqual(after.length, 1, '合并后只剩 1 个分类');
        assertEqual(after[0].name, '教育学');
        assertEqual(after[0].count, 5, '教育学应有 5 题（2+3）');

        // 验证题目数据
        const lib = LX.LibraryAPI.get(libId).data;
        const allEdu = lib.questions.every((q) => q.category === '教育学');
        assertTrue(allEdu, '所有题目 category 应为教育学');
    });
});
