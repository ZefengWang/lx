import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 系统级完整旅程：导入 → 五题型作答 → 错题本 → 导出进度 → 恢复
 */
describe('系统：完整学习旅程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('导入→作答→错题本→进度导出导入→统计一致', async () => {
        const questions = [
            { id: 1, type: 'single', question: '单选', options: ['A', 'B'], answer: 'A', explanation: '', category: '语文' },
            { id: 2, type: 'multi', question: '多选', options: ['A', 'B', 'C'], answer: 'A,B', explanation: '', category: '语文' },
            { id: 3, type: 'judge', question: '判断', options: ['对', '错'], answer: '对', explanation: '', category: '数学' },
            { id: 4, type: 'fill', question: '填空', answer: '北京', explanation: '', category: '数学' },
            // essay 不设 answerText → notGraded，不进错题本（避免相似度误伤本旅程断言）
            { id: 5, type: 'essay', question: '简答', answer: '', explanation: '', category: '综合' },
        ];
        const createR = LX.LibraryAPI.create('旅程库', questions);
        assertOk(createR);
        LX.LibraryAPI.switch(createR.data.id);

        // 作答：1 对 2 错 3 对 4 对 5 不判分
        assertTrue(LX.QuestionAPI.answer(1, 'A').data.correct);
        assertTrue(!LX.QuestionAPI.answer(2, ['A']).data.correct);
        assertTrue(LX.QuestionAPI.answer(3, '对').data.correct);
        assertTrue(LX.QuestionAPI.answer(4, '北京').data.correct);
        const essay = LX.QuestionAPI.answer(5, '随便写');
        assertOk(essay);
        assertTrue(essay.data.notGraded, '无 answerText 的简答应为 notGraded');

        assertEqual(LX.WrongBookAPI.count().data, 1, '仅多选错题入错题本');
        assertOk(LX.WrongBookAPI.enter());
        const q2 = LX.QuestionAPI.get(2).data;
        assertOk(LX.QuestionAPI.answer(q2, ['A', 'B']));
        const mark = LX.WrongBookAPI.markMastered(q2);
        assertOk(mark);
        assertTrue(mark.data.cleared);

        const summary = LX.StatsAPI.summary();
        assertOk(summary);
        assertEqual(summary.data.review, 0);
        assertTrue(summary.data.mastered >= 4);

        // 进度备份往返（对外导出入口在 IOAPI；ProgressAPI 别名为 export/import）
        const exp = LX.IOAPI.exportProgress();
        assertOk(exp);
        assertOk(LX.ProgressAPI.reset());
        assertEqual(LX.StatsAPI.summary().data.mastered, 0);
        assertOk(LX.IOAPI.importProgress(exp.data));
        assertEqual(LX.StatsAPI.summary().data.mastered, summary.data.mastered);

        // 分类仍在
        const cats = LX.CategoryAPI.list();
        assertOk(cats);
        assertTrue(cats.data.some((c) => c.name === '语文'));
    });
}, { layer: 'system', tags: ['e2e', 'journey'] });
