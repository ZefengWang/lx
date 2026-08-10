import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertErr } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

describe('DrillAPI 练习会话', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('S=无题库 A=start → R=STATE_ERROR', () => {
        const r = LX.DrillAPI.start({ mode: 'quick', count: 10 });
        assertErr(r, 'STATE_ERROR');
    });

    it('S=有库 A=start count=0/NaN → R=INVALID_INPUT；空分类 → OUT_OF_RANGE', () => {
        createAndSwitchLibrary('drill无效count', [
            { id: 1, type: 'essay', question: '仅甲类', answer: '', category: '甲' },
        ]);
        assertErr(LX.DrillAPI.start({ mode: 'quick', count: 0 }), 'INVALID_INPUT');
        assertErr(LX.DrillAPI.start({ mode: 'quick', count: Number.NaN }), 'INVALID_INPUT');
        assertErr(LX.DrillAPI.start({ mode: 'quick', count: 5, category: '不存在类' }), 'OUT_OF_RANGE');
    });

    it('S=无会话 A=afterAnswer/prev/next → R=STATE_ERROR', () => {
        createAndSwitchLibrary('drill无会话', [
            { id: 1, type: 'essay', question: 'q', answer: '', category: 'A' },
        ]);
        assertErr(LX.DrillAPI.afterAnswer({ correct: true }), 'STATE_ERROR');
        assertErr(LX.DrillAPI.prev(), 'STATE_ERROR');
        assertErr(LX.DrillAPI.next(), 'STATE_ERROR');
    });

    it('S=混有 none/mastered A=start count=3 → R=优先 none', () => {
        createAndSwitchLibrary('drill库', [
            { id: 1, type: 'essay', question: '未1', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '未2', answer: '', category: 'A' },
            { id: 3, type: 'essay', question: '已掌握', answer: '', category: 'A' },
            { id: 4, type: 'essay', question: '未3', answer: '', category: 'A' },
        ]);
        LX.ProgressAPI.setStatus(3, 'mastered');
        const r = LX.DrillAPI.start({ mode: 'quick', count: 3 });
        assertOk(r);
        assertEqual(r.data.total, 3);
        const cur = LX.DrillAPI.current().data;
        const statuses = cur.queue.map((id) => LX.ProgressAPI.getStatus(id).data);
        const noneCount = statuses.filter((s) => s === 'none').length;
        assertTrue(noneCount >= 2, '应优先抽未标记');
    });

    it('S=会话中 A=record+prev+next → R=回看后再回进度', () => {
        createAndSwitchLibrary('drill回看', [
            { id: 1, type: 'single', question: 'Q1', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 2, type: 'single', question: 'Q2', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 3, type: 'single', question: 'Q3', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        assertOk(LX.DrillAPI.start({ mode: 'memory', count: 3 }));
        const q1 = LX.DrillAPI.current().data.qId;
        LX.DrillAPI.recordAnswer(q1, { userAnswer: 'A', correct: true, correctAnswer: 'A' });
        assertOk(LX.DrillAPI.advanceProgress());
        const q2 = LX.DrillAPI.current().data.qId;
        assertTrue(q2 !== q1);

        assertOk(LX.DrillAPI.prev());
        const back = LX.DrillAPI.current().data;
        assertEqual(back.qId, q1);
        assertEqual(back.answer.userAnswer, 'A');
        assertTrue(back.viewingHistory);

        assertOk(LX.DrillAPI.next());
        const again = LX.DrillAPI.current().data;
        assertEqual(again.qId, q2);
        assertEqual(again.viewingHistory, false);
    });

    it('S=quick A=afterAnswer correct → R=delayMs=0；wrong → 5000', () => {
        createAndSwitchLibrary('drill节奏', [
            { id: 1, type: 'single', question: 'Q1', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 2, type: 'single', question: 'Q2', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        assertOk(LX.DrillAPI.start({ mode: 'quick', count: 2 }));
        const okR = LX.DrillAPI.afterAnswer({ correct: true });
        assertOk(okR);
        assertEqual(okR.data.delayMs, 0);
        const badR = LX.DrillAPI.afterAnswer({ correct: false });
        assertEqual(badR.data.delayMs, 5000);
    });

    it('S=memory A=afterAnswer → R=不推进', () => {
        createAndSwitchLibrary('drill背诵', [
            { id: 1, type: 'single', question: 'Q1', options: ['A', 'B'], answer: 'A', category: 'A' },
            { id: 2, type: 'single', question: 'Q2', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        assertOk(LX.DrillAPI.start({ mode: 'memory', count: 2 }));
        const r = LX.DrillAPI.afterAnswer({ correct: true });
        assertOk(r);
        assertEqual(r.data.advanced, false);
        assertEqual(LX.DrillAPI.current().data.progressIndex, 0);
    });

    it('S=memory 且不传 count → R=全量建队', () => {
        createAndSwitchLibrary('drill全量', [
            { id: 1, type: 'essay', question: 'a', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: 'b', answer: '', category: 'A' },
            { id: 3, type: 'essay', question: 'c', answer: '', category: 'A' },
        ]);
        const r = LX.DrillAPI.start({ mode: 'memory' });
        assertOk(r);
        assertEqual(r.data.total, 3);
        LX.DrillAPI.exit();
    });

    it('S=buildPreferNoneQueue 纯函数优先 none', () => {
        createAndSwitchLibrary('drill纯', [
            { id: 1, type: 'essay', question: 'a', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: 'b', answer: '', category: 'A' },
        ]);
        LX.ProgressAPI.setStatus(1, 'review');
        const lib = LX.LibraryAPI.get(LX.LibraryAPI.current().data).data;
        const q = LX.DrillAPI.buildPreferNoneQueue(lib.questions, 1);
        assertEqual(q.length, 1);
        assertEqual(q[0], 2);
    });
}, { layer: 'api', tags: ['drill', 'unit'] });
