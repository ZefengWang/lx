import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 串联 SAR；单点 SAR 见 unit/ui/matrix。
 * 用户流程 4：进度备份恢复
 * 做题若干 → 导出进度 → 重置 → 导入进度 → 状态完全恢复
 */
describe('集成：进度备份恢复', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('进度备份库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'single', question: 'q2', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 3, type: 'single', question: 'q3', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);
    });

    it('做题 → 导出进度 → 重置 → 导入进度 → 完全恢复', () => {
        // 1. 做题：q1 掌握，q2 错题
        const q1 = LX.QuestionAPI.get(1).data;
        const q2 = LX.QuestionAPI.get(2).data;
        LX.ProgressAPI.setStatus(q1, 'mastered', { libId, questions: [q1, q2] });
        LX.ProgressAPI.setStatus(q2, 'review', { libId, questions: [q1, q2] });

        const statsBefore = LX.StatsAPI.summary().data;
        assertEqual(statsBefore.mastered, 1);
        assertEqual(statsBefore.review, 1);

        // 2. 导出进度
        const exportR = LX.IOAPI.exportProgress();
        assertOk(exportR);
        const progressJson = exportR.data;
        assertTrue(progressJson.includes(libId), '进度 JSON 应含 libId');

        // 3. 重置进度
        LX.ProgressAPI.reset(libId);
        const statsAfterReset = LX.StatsAPI.summary().data;
        assertEqual(statsAfterReset.mastered, 0);
        assertEqual(statsAfterReset.review, 0);

        // 4. 导入进度
        const importR = LX.IOAPI.importProgress(progressJson);
        assertOk(importR);

        // 5. 验证状态完全恢复
        const statsRestored = LX.StatsAPI.summary().data;
        assertEqual(statsRestored.mastered, 1, '掌握数应恢复');
        assertEqual(statsRestored.review, 1, '错题数应恢复');
        assertEqual(statsRestored.percent, 33, '1/3 ≈ 33%');
    });
});
