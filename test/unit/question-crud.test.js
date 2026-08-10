import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertErr, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

describe('QuestionAPI - CRUD', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        createAndSwitchLibrary('CRUD库', [
            { id: 1, type: 'single', question: '原题', options: ['A', 'B'], answer: 'A', category: '甲' },
        ]);
    });

    it('list 返回当前库题目；可按 category 过滤', () => {
        const all = LX.QuestionAPI.list();
        assertOk(all);
        assertEqual(all.data.total, 1);

        const filtered = LX.QuestionAPI.list({ category: '甲' });
        assertEqual(filtered.data.total, 1);
        const empty = LX.QuestionAPI.list({ category: '不存在' });
        assertEqual(empty.data.total, 0);
    });

    it('add 成功写入并可 get；空题干失败', () => {
        const bad = LX.QuestionAPI.add({ question: '' });
        assertErr(bad);

        const r = LX.QuestionAPI.add({
            type: 'essay',
            question: '新增简答',
            answer: '',
            category: '乙',
        });
        assertOk(r);
        assertTrue(r.data.id > 0);
        const got = LX.QuestionAPI.get(r.data.id);
        assertOk(got);
        assertEqual(got.data.question, '新增简答');
        assertEqual(LX.QuestionAPI.list().data.total, 2);
    });

    it('update 可改题干；不存在 id 失败', () => {
        const q = LX.QuestionAPI.list().data.questions[0];
        const r = LX.QuestionAPI.update(q.uid, { question: '已改题干' });
        assertOk(r);
        assertEqual(LX.QuestionAPI.get(q.uid).data.question, '已改题干');

        const miss = LX.QuestionAPI.update(99999, { question: 'x' });
        assertErr(miss);
    });

    it('delete 删除后 get 失败；未选题库时 add 失败', async () => {
        const q = LX.QuestionAPI.list().data.questions[0];
        assertOk(LX.QuestionAPI.delete(q.uid));
        assertErr(LX.QuestionAPI.get(q.uid));
        assertEqual(LX.QuestionAPI.list().data.total, 0);

        await resetStateBeforeEach();
        LX = getLX();
        const noLib = LX.QuestionAPI.add({ question: '无库' });
        assertErr(noLib);
    });

    it('S=有库 A=resetAttempt → R=ok 且 emit QUESTION_UPDATED', () => {
        let payload = null;
        const off = LX.on(LX.Events.QUESTION_UPDATED, (p) => { payload = p; });
        const r = LX.QuestionAPI.resetAttempt(1);
        assertOk(r);
        assertTrue(!!payload);
        assertEqual(payload.qId, 1);
        assertEqual(payload.patch._resetAttempt, true);
        off();
    });
}, { layer: 'api', tags: ['question', 'crud'] });
