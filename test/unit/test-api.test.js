import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertLength } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('TestAPI', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('snapshot/restore 往返一致', () => {
        // 准备一些数据
        LX.LibraryAPI.create('题库1', [{ id: 1, type: 'essay', question: 'q1', answer: '', explanation: '' }]);
        const listBefore = LX.LibraryAPI.list();
        const snap = LX.TestAPI.snapshot();
        assertTrue(typeof snap === 'string', 'snapshot 应返回字符串');

        // 改变数据
        LX.TestAPI.reset();
        assertLength(LX.LibraryAPI.list().data, 0, 'reset 后应无题库');

        // 恢复
        const r = LX.TestAPI.restore(snap);
        assertOk(r);

        const listAfter = LX.LibraryAPI.list();
        assertEqual(listAfter.data.length, listBefore.data.length, '题库数应一致');
        assertEqual(listAfter.data[0].name, '题库1');
    });

    it('seed("small") 后 LibraryAPI.list()[0].questionCount === 10', () => {
        const r = LX.TestAPI.seed('small');
        assertOk(r);
        const list = LX.LibraryAPI.list();
        assertLength(list.data, 1);
        assertEqual(list.data[0].questionCount, 10);
        assertEqual(list.data[0].name, '小型题库（10 题简答）');

        // 验证当前已切换到该题库
        assertTrue(LX.LibraryAPI.current().data, '应已 switch 到该题库');
    });
});
