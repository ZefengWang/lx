import { describe, it, beforeEach } from '../runner.js';
import { assertEqual, assertOk, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

/**
 * SAR / 交互：主 Events 至少各有一处 emit 断言
 * S=触发前置  A=API 调用  R=对应事件 payload
 */
describe('Events 矩阵（主事件 emit）', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    function once(event) {
        return new Promise((resolve) => {
            const off = LX.on(event, (payload) => {
                off();
                resolve(payload);
            });
        });
    }

    it('S=建库切库删库 → LIBRARY_CREATED / SWITCHED / DELETED', async () => {
        const pCreate = once(LX.Events.LIBRARY_CREATED);
        const created = LX.LibraryAPI.create('事件库A', [
            { id: 1, type: 'essay', question: 'e1', answer: '' },
        ], { skipDuplicateCheck: true });
        assertOk(created);
        await pCreate;

        const pSwitch = once(LX.Events.LIBRARY_SWITCHED);
        LX.LibraryAPI.switch(created.data.id);
        await pSwitch;

        const other = LX.LibraryAPI.create('事件库B', [
            { id: 1, type: 'essay', question: 'e2', answer: '' },
        ], { skipDuplicateCheck: true });
        assertOk(other);
        LX.LibraryAPI.switch(other.data.id);

        const pDel = once(LX.Events.LIBRARY_DELETED);
        LX.LibraryAPI.delete(created.data.id);
        await pDel;
    });

    it('S=有库 A=add/update/delete/answer → QUESTION_*', async () => {
        createAndSwitchLibrary('事件题库', [
            { id: 1, type: 'single', question: 'q', options: ['A', 'B'], answer: 'A' },
        ]);

        const pAdd = once(LX.Events.QUESTION_ADDED);
        const addR = LX.QuestionAPI.add({ type: 'essay', question: '新题', answer: '' });
        assertOk(addR);
        await pAdd;

        const pUpd = once(LX.Events.QUESTION_UPDATED);
        assertOk(LX.QuestionAPI.update(addR.data.id, { question: '新题改' }));
        await pUpd;

        const pAns = once(LX.Events.QUESTION_ANSWERED);
        assertOk(LX.QuestionAPI.answer(1, 'A'));
        await pAns;

        const pDel = once(LX.Events.QUESTION_DELETED);
        assertOk(LX.QuestionAPI.delete(addR.data.id));
        await pDel;
    });

    it('S=有题 A=setStatus/reset/import → PROGRESS_* / STATUS_CHANGED', async () => {
        createAndSwitchLibrary('进度事件库', [
            { id: 1, type: 'essay', question: 'p1', answer: '' },
        ]);
        const q = LX.QuestionAPI.get(1).data;

        const pStatus = once(LX.Events.QUESTION_STATUS_CHANGED);
        LX.ProgressAPI.setStatus(q, 'mastered');
        const statusPayload = await pStatus;
        assertEqual(statusPayload.newStatus, 'mastered');

        const exported = LX.ProgressAPI.export();
        assertOk(exported);

        const pReset = once(LX.Events.PROGRESS_RESET);
        LX.ProgressAPI.reset();
        await pReset;

        const pImp = once(LX.Events.PROGRESS_IMPORTED);
        assertOk(LX.ProgressAPI.import(exported.data));
        await pImp;
    });

    it('S=有题 A=next/setCategory → NAVIGATION_CHANGED', async () => {
        createAndSwitchLibrary('导航事件库', [
            { id: 1, type: 'essay', question: 'n1', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: 'n2', answer: '', category: '乙' },
        ]);
        const pNav = once(LX.Events.NAVIGATION_CHANGED);
        LX.NavigationAPI.next();
        await pNav;

        const pCat = once(LX.Events.NAVIGATION_CHANGED);
        LX.NavigationAPI.setCategory('甲');
        await pCat;
    });

    it('S=有错题 A=enter → WRONGBOOK_ENTERED；清完 → CLEARED/EXITED', async () => {
        createAndSwitchLibrary('错题事件库', [
            { id: 1, type: 'single', question: 'w1', options: ['A', 'B'], answer: 'A' },
        ]);
        const q1 = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q1, 'review');

        const pEnter = once(LX.Events.WRONGBOOK_ENTERED);
        assertOk(LX.WrongBookAPI.enter());
        await pEnter;

        let cleared = false;
        let exited = false;
        const offC = LX.on(LX.Events.WRONGBOOK_CLEARED, () => { cleared = true; });
        const offE = LX.on(LX.Events.WRONGBOOK_EXITED, () => { exited = true; });
        assertOk(LX.WrongBookAPI.markMastered(q1));
        assertTrue(cleared || exited, '清完错题本应触发 CLEARED 或 EXITED');
        offC();
        offE();
    });

    it('S=有库 A=rename → LIBRARY_RENAMED', async () => {
        const created = LX.LibraryAPI.create('改名前', [
            { id: 1, type: 'essay', question: 'r1', answer: '' },
        ], { skipDuplicateCheck: true });
        assertOk(created);
        const p = once(LX.Events.LIBRARY_RENAMED);
        assertOk(LX.LibraryAPI.rename(created.data.id, '改名后'));
        const payload = await p;
        assertEqual(payload.name, '改名后');
    });

    it('S=有分类 A=CategoryAPI.rename → CATEGORY_RENAMED', async () => {
        createAndSwitchLibrary('分类事件库', [
            { id: 1, type: 'essay', question: 'c1', answer: '', category: '旧类' },
            { id: 2, type: 'essay', question: 'c2', answer: '', category: '旧类' },
        ]);
        const p = once(LX.Events.CATEGORY_RENAMED);
        assertOk(LX.CategoryAPI.rename('旧类', '新类'));
        const payload = await p;
        assertEqual(payload.newName, '新类');
        assertEqual(payload.changedCount, 2);
    });

    it('S=订阅方抛错 A=emit 任意事件 → STATE_ERROR', async () => {
        const p = once(LX.Events.STATE_ERROR);
        const off = LX.on('lx:test-throw', () => {
            throw new Error('handler boom');
        });
        LX.emit('lx:test-throw', {});
        const payload = await p;
        assertTrue(!!payload.error);
        off();
    });

    it('S=启动后 A=读常量 → LX_READY 事件名约定存在（启动时已派发）', () => {
        assertEqual(LX.Events.LX_READY, 'lx:ready');
        // 可手动再 emit 验证总线通路
        let hit = false;
        const off = LX.on(LX.Events.LX_READY, () => { hit = true; });
        LX.emit(LX.Events.LX_READY, { from: 'test' });
        assertTrue(hit);
        off();
    });
}, { layer: 'integration', tags: ['events', 'sar'] });
