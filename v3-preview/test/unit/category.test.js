import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertLength } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('CategoryAPI', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('分类题库', [
            { id: 1, type: 'essay', question: 'q1', category: '教育学', answer: '', explanation: '' },
            { id: 2, type: 'essay', question: 'q2', category: '教育学', answer: '', explanation: '' },
            { id: 3, type: 'essay', question: 'q3', category: '心理学', answer: '', explanation: '' },
            { id: 4, type: 'essay', question: 'q4', answer: '', explanation: '' }, // 未分类
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);
    });

    it('list 返回正确分类与计数', () => {
        const r = LX.CategoryAPI.list();
        assertOk(r);
        assertLength(r.data, 3);

        const edu = r.data.find((c) => c.name === '教育学');
        assertEqual(edu.count, 2);

        const psy = r.data.find((c) => c.name === '心理学');
        assertEqual(psy.count, 1);

        const uncategorized = r.data.find((c) => c.name === '未分类');
        assertEqual(uncategorized.count, 1);
    });

    it('rename 合并到已存在分类', () => {
        // 将 '心理学' rename 为 '教育学'
        const r = LX.CategoryAPI.rename('心理学', '教育学');
        assertOk(r);
        assertEqual(r.data.changedCount, 1);

        const list = LX.CategoryAPI.list();
        const edu = list.data.find((c) => c.name === '教育学');
        assertEqual(edu.count, 3, '合并后教育学应有 3 题');
        assertTrue(!list.data.find((c) => c.name === '心理学'), '心理学应已合并消失');
    });
});
