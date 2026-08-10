import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertErr } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

describe('NavigationAPI：searchPlaylist', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('enter 后 prev/next 只在队列内；clear 后恢复全库', () => {
        createAndSwitchLibrary('队列库', [
            { id: 1, type: 'essay', question: 'A1', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: 'A2', answer: '', category: 'A' },
            { id: 3, type: 'essay', question: 'B1', answer: '', category: 'B' },
        ]);
        const ids = [1, 3].map((id) => LX.QuestionAPI.get(id).data.uid);
        assertOk(LX.NavigationAPI.enterSearchPlaylist({ keywords: ['x'], uids: ids }));
        assertEqual(LX.NavigationAPI.current().data.total, 2);
        assertOk(LX.NavigationAPI.goto(0));
        assertOk(LX.NavigationAPI.next());
        assertEqual(LX.NavigationAPI.current().data.qId, ids[1]);
        assertOk(LX.NavigationAPI.next());
        assertEqual(LX.NavigationAPI.current().data.qId, ids[0], '应在 2 题内循环');
        assertOk(LX.NavigationAPI.clearSearchPlaylist());
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
        assertEqual(LX.NavigationAPI.current().data.total, 3);
    });

    it('enter 空 uids → INVALID_INPUT；clear 无 playlist → ok', () => {
        createAndSwitchLibrary('空队列', [
            { id: 1, type: 'essay', question: 'q', answer: '', category: 'A' },
        ]);
        assertErr(LX.NavigationAPI.enterSearchPlaylist({ uids: [] }), 'INVALID_INPUT');
        assertOk(LX.NavigationAPI.clearSearchPlaylist());
    });

    it('getActiveList 顺序与 playlist uids 一致', () => {
        createAndSwitchLibrary('activeList库', [
            { id: 1, type: 'essay', question: '一', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '二', answer: '', category: 'A' },
            { id: 3, type: 'essay', question: '三', answer: '', category: 'A' },
        ]);
        const u2 = LX.QuestionAPI.get(2).data.uid;
        const u1 = LX.QuestionAPI.get(1).data.uid;
        assertOk(LX.NavigationAPI.enterSearchPlaylist({ keywords: ['k'], uids: [u2, u1] }));
        const list = LX.NavigationAPI.getActiveList();
        assertOk(list);
        assertEqual(list.data.length, 2);
        assertEqual(list.data[0].uid, u2);
        assertEqual(list.data[1].uid, u1);
    });

    it('Drill.start 会清 searchPlaylist；错题本 enter 也会清', () => {
        createAndSwitchLibrary('互斥库', [
            { id: 1, type: 'essay', question: 'a', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: 'b', answer: '', category: 'A' },
        ]);
        const uids = [1, 2].map((id) => LX.QuestionAPI.get(id).data.uid);
        assertOk(LX.NavigationAPI.enterSearchPlaylist({ keywords: ['a'], uids }));
        assertTrue(!!LX.NavigationAPI.getSearchPlaylist());
        assertOk(LX.DrillAPI.start({ mode: 'memory' }));
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
        LX.DrillAPI.exit();

        assertOk(LX.NavigationAPI.enterSearchPlaylist({ keywords: ['a'], uids }));
        LX.ProgressAPI.setStatus(1, 'review');
        assertOk(LX.WrongBookAPI.enter());
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
        LX.WrongBookAPI.exit();
    });

    it('playlist 优先于 category 筛选', () => {
        createAndSwitchLibrary('优先库', [
            { id: 1, type: 'essay', question: '甲题', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: '乙题', answer: '', category: '乙' },
        ]);
        assertOk(LX.NavigationAPI.setCategory('甲'));
        assertEqual(LX.NavigationAPI.current().data.total, 1);
        const u2 = LX.QuestionAPI.get(2).data.uid;
        assertOk(LX.NavigationAPI.enterSearchPlaylist({
            keywords: ['乙'],
            uids: [u2],
        }));
        // playlist 优先：即使 category 仍是甲，current.total 也是 1 且为乙题
        assertEqual(LX.NavigationAPI.current().data.total, 1);
        assertEqual(LX.NavigationAPI.current().data.qId, u2);
    });
}, { layer: 'api', tags: ['navigation', 'search'] });
