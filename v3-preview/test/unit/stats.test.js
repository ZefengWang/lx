import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('StatsAPI', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('统计题库', [
            { id: 1, type: 'single', category: '教育学', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'multi', category: '教育学', question: 'q2', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 3, type: 'judge', category: '心理学', question: 'q3', options: [], answer: '对', explanation: '' },
            { id: 4, type: 'fill', category: '心理学', question: 'q4____', options: [], answer: '答案', explanation: '' },
            { id: 5, type: 'essay', category: '哲学', question: 'q5', answer: '', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);

        // q1 掌握，q2 错题
        const q1 = LX.QuestionAPI.get(1).data;
        const q2 = LX.QuestionAPI.get(2).data;
        LX.ProgressAPI.setStatus(q1, 'mastered', { libId, questions: [q1, q2] });
        LX.ProgressAPI.setStatus(q2, 'review', { libId, questions: [q1, q2] });
    });

    it('summary 返回 total/mastered/review/percent/byCategory/byType', () => {
        const r = LX.StatsAPI.summary();
        assertOk(r);
        const s = r.data;
        assertEqual(s.total, 5);
        assertEqual(s.mastered, 1);
        assertEqual(s.review, 1);
        assertEqual(s.percent, 20, '1/5 = 20%');

        assertTrue(s.byCategory, 'byCategory 应存在');
        assertEqual(s.byCategory['教育学'].total, 2);
        assertEqual(s.byCategory['教育学'].mastered, 1);
        assertEqual(s.byCategory['教育学'].review, 1);
        assertEqual(s.byCategory['哲学'].total, 1);

        assertTrue(s.byType, 'byType 应存在');
        assertEqual(s.byType.single.mastered, 1);
        assertEqual(s.byType.multi.review, 1);
    });

    it('byType 各题型和 = total', () => {
        const r = LX.StatsAPI.byType();
        assertOk(r);
        const t = r.data;
        const total = Object.values(t).reduce((sum, s) => sum + s.total, 0);
        assertEqual(total, 5, '各题型题目数之和应等于总数 5');
    });
});
