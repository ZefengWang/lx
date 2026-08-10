import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertErr, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('WrongBookAPI', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('S=未选题库 A=enter → R=STATE_ERROR', () => {
        assertErr(LX.WrongBookAPI.enter(), 'STATE_ERROR');
    });

    it('无错题时 enter 返回 NO_WRONG', () => {
        const r = LX.LibraryAPI.create('无错题库', [
            { id: 1, type: 'essay', question: 'q1', answer: '', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);

        const enterR = LX.WrongBookAPI.enter();
        assertErr(enterR, 'NO_WRONG', '无错题时 enter 应返回 NO_WRONG');
    });

    it('enter 后 navigation 只见 review 题', () => {
        // 构造 3 题，2 题 review
        const r = LX.LibraryAPI.create('错题题库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'single', question: 'q2', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 3, type: 'single', question: 'q3', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);

        // 答错 q1, q2，答对 q3
        LX.QuestionAPI.answer(1, 'B'); // 错
        LX.QuestionAPI.answer(2, 'B'); // 错
        LX.QuestionAPI.answer(3, 'A'); // 对（mastered）

        const count = LX.WrongBookAPI.count();
        assertEqual(count.data, 2, '应有 2 道错题');

        // 进入错题模式
        const enterR = LX.WrongBookAPI.enter();
        assertOk(enterR);
        assertEqual(enterR.data.wrongCount, 2);

        // navigation 应只见 2 道错题
        const cur = LX.NavigationAPI.current();
        assertEqual(cur.data.total, 2, '错题模式仅见 2 题');
    });

    it('markMastered 全部清空触发 WRONGBOOK_CLEARED + 自动 exit', () => {
        const r = LX.LibraryAPI.create('错题循环库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'single', question: 'q2', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);

        // 两题都答错
        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, 'B');

        LX.WrongBookAPI.enter();

        let cleared = false;
        LX.on(LX.Events.WRONGBOOK_CLEARED, () => {
            cleared = true;
        });

        // 标记 q1 掌握
        const r1 = LX.WrongBookAPI.markMastered(1);
        assertOk(r1);
        assertFalse(r1.data.cleared, '还剩 1 题不应 cleared');
        assertEqual(r1.data.remaining, 1);

        // 标记 q2 掌握，应触发 cleared + 自动 exit
        const r2 = LX.WrongBookAPI.markMastered(2);
        assertOk(r2);
        assertTrue(r2.data.cleared, '最后一题应 cleared=true');
        assertTrue(cleared, '应触发 WRONGBOOK_CLEARED 事件');

        // 已自动退出
        assertFalse(LX.NavigationAPI.current().data.total === 0, '退出后 navigation 应恢复全量');
    });

    it('S=有错题 A=list → R=仅 review；exit 退出专注模式', () => {
        const r = LX.LibraryAPI.create('错题列表库', [
            { id: 1, type: 'single', question: 'wb-list-1', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 2, type: 'single', question: 'wb-list-2', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);
        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, 'A');
        const list = LX.WrongBookAPI.list();
        assertOk(list);
        assertEqual(list.data.count, 1);
        assertEqual(list.data.questions.length, 1);
        assertTrue(String(list.data.questions[0].question || '').includes('wb-list-1'));

        assertOk(LX.WrongBookAPI.enter());
        assertOk(LX.WrongBookAPI.exit());
        // 退出后可再次 enter（错题仍在）
        assertOk(LX.WrongBookAPI.enter());
        assertOk(LX.WrongBookAPI.exit());
    });
});
