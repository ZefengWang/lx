import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertErr, assertEqual, assertTrue, assertLength } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('LibraryAPI', () => {
    beforeEach(resetStateBeforeEach);

    it('create 后 list/get/current 正确', () => {
        const LX = getLX();
        const r = LX.LibraryAPI.create('测试题库', [
            { id: 1, type: 'essay', question: '题1', answer: '', explanation: '解析1' },
            { id: 2, type: 'essay', question: '题2', answer: '', explanation: '解析2' },
        ]);
        assertOk(r, 'create 应成功');
        const libId = r.data.id;

        const list = LX.LibraryAPI.list();
        assertOk(list);
        assertLength(list.data, 1);
        assertEqual(list.data[0].name, '测试题库');
        assertEqual(list.data[0].questionCount, 2);

        const lib = LX.LibraryAPI.get(libId);
        assertOk(lib);
        assertEqual(lib.data.name, '测试题库');
        assertEqual(lib.data.questions[0].uid, 1, 'uid 应从 1 开始');

        const current = LX.LibraryAPI.current();
        assertOk(current);
        assertEqual(current.data, null, '刚 create 后未 switch，current 应为 null');
    });

    it('create 重复内容触发 DUPLICATE', () => {
        const LX = getLX();
        const qs = [
            { id: 1, type: 'essay', question: '唯一题目', answer: '', explanation: '解析' },
        ];
        const r1 = LX.LibraryAPI.create('题库1', qs);
        assertOk(r1);

        const r2 = LX.LibraryAPI.create('题库2', qs);
        assertErr(r2, 'DUPLICATE', '相同内容应触发 DUPLICATE');
    });

    it('switch 后 current() 返回新 id，状态重置', () => {
        const LX = getLX();
        const r1 = LX.LibraryAPI.create('题库1', [{ id: 1, type: 'essay', question: 'q1', answer: '', explanation: '' }]);
        const r2 = LX.LibraryAPI.create('题库2', [{ id: 1, type: 'essay', question: 'q2', answer: '', explanation: '' }]);
        const id1 = r1.data.id;
        const id2 = r2.data.id;

        const sw = LX.LibraryAPI.switch(id1);
        assertOk(sw);
        assertEqual(LX.LibraryAPI.current().data, id1);

        // 修改状态后切换
        const q = LX.LibraryAPI.get(id1).data.questions[0];
        LX.ProgressAPI.setStatus(q, 'mastered', { libId: id1, questions: [q] });

        // 切换到题库2
        LX.LibraryAPI.switch(id2);
        assertEqual(LX.LibraryAPI.current().data, id2);

        // 切回题库1，验证进度仍保留（进度按 libId 隔离）
        LX.LibraryAPI.switch(id1);
        const status = LX.ProgressAPI.getStatus(LX.LibraryAPI.get(id1).data.questions[0]);
        assertEqual(status.data, 'mastered', '进度应按 libId 保留');
    });

    it('delete 后 list 不含，进度同步清除', () => {
        const LX = getLX();
        const r = LX.LibraryAPI.create('待删题库', [{ id: 1, type: 'essay', question: 'q', answer: '', explanation: '' }]);
        const id = r.data.id;
        LX.LibraryAPI.switch(id);
        const q = LX.LibraryAPI.get(id).data.questions[0];
        LX.ProgressAPI.setStatus(q, 'mastered', { libId: id, questions: [q] });

        const del = LX.LibraryAPI.delete(id);
        assertOk(del);

        const list = LX.LibraryAPI.list();
        assertOk(list);
        assertTrue(!list.data.find((l) => l.id === id), 'list 不应包含已删题库');

        // 验证进度已清除（通过 progressMap 检查）
        const progMap = LX.ProgressAPI._getProgressMap();
        assertTrue(!progMap[id] || Object.keys(progMap[id]).length === 0, '题库进度应已清除');
    });
});
