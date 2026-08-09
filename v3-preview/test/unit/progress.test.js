import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('ProgressAPI', () => {
    let LX;
    let libId;
    let q1;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('进度题库', [
            { id: 1, type: 'essay', question: 'q1', answer: '', explanation: '' },
            { id: 2, type: 'essay', question: 'q2', answer: '', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);
        q1 = LX.QuestionAPI.get(1).data;
    });

    it('setStatus 触发 QUESTION_STATUS_CHANGED 事件', () => {
        let received = null;
        const off = LX.on(LX.Events.QUESTION_STATUS_CHANGED, (p) => {
            received = p;
        });
        LX.ProgressAPI.setStatus(q1, 'mastered', { libId, questions: [q1] });
        assertTrue(received, '应触发 QUESTION_STATUS_CHANGED');
        assertEqual(received.qId, '1');
        assertEqual(received.oldStatus, 'none');
        assertEqual(received.newStatus, 'mastered');
        off();
    });

    it('reset 后 stats 全 0', () => {
        // 先设置一些进度
        const q2 = LX.QuestionAPI.get(2).data;
        LX.ProgressAPI.setStatus(q1, 'mastered', { libId, questions: [q1, q2] });
        LX.ProgressAPI.setStatus(q2, 'review', { libId, questions: [q1, q2] });

        const before = LX.ProgressAPI.stats(libId, [q1, q2]).data;
        assertEqual(before.mastered, 1);
        assertEqual(before.review, 1);

        const r = LX.ProgressAPI.reset(libId);
        assertOk(r);

        const after = LX.ProgressAPI.stats(libId, [q1, q2]).data;
        assertEqual(after.mastered, 0);
        assertEqual(after.review, 0);
        assertEqual(after.percent, 0);
    });

    it('快速连续 100 次 setStatus 不卡顿（bug 4 性能回归）', () => {
        const q2 = LX.QuestionAPI.get(2).data;
        const questions = [q1, q2];
        const t0 = performance.now();
        for (let i = 0; i < 100; i++) {
            const status = i % 2 === 0 ? 'mastered' : 'review';
            LX.ProgressAPI.setStatus(q1, status, { libId, questions });
        }
        const elapsed = performance.now() - t0;
        // 100 次同步操作应 < 500ms（缓存命中）
        assertTrue(elapsed < 500, `100 次 setStatus 耗时 ${elapsed.toFixed(1)}ms，应 < 500ms`);

        // 最终统计正确
        const s = LX.ProgressAPI.stats(libId, questions).data;
        assertEqual(s.mastered + s.review, 1, 'q1 最终只有一个状态');
    });
});
