import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertFalse, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('QuestionAPI - 答题判分', () => {
    let LX;
    let allTypesLibId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('全题型题库', [
            { id: 1, type: 'single', question: '单选题', options: ['A', 'B', 'C', 'D'], answer: 'B', explanation: '' },
            { id: 2, type: 'multi', question: '多选题', options: ['A', 'B', 'C', 'D'], answer: 'A,C', explanation: '' },
            { id: 3, type: 'judge', question: '判断题', options: [], answer: '对', explanation: '' },
            { id: 4, type: 'fill', question: '填空题____', options: [], answer: '北京', explanation: '' },
            { id: 5, type: 'essay', question: '简答题', options: [], answer: '', explanation: '解析', answerText: '参考答案' },
        ]);
        allTypesLibId = r.data.id;
        LX.LibraryAPI.switch(allTypesLibId);
    });

    it('answer 单选正确 → autoStatus=mastered', () => {
        const r = LX.QuestionAPI.answer(1, 'B');
        assertOk(r);
        assertTrue(r.data.correct, '答 B 应判对');
        assertEqual(r.data.autoStatus, 'mastered');

        const status = LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data);
        assertEqual(status.data, 'mastered');
    });

    it('answer 多选漏选 → correct=false', () => {
        // 正确答案 A,C，用户只选 A
        const r = LX.QuestionAPI.answer(2, ['A']);
        assertOk(r);
        assertFalse(r.data.correct, '漏选应判错');
        assertEqual(r.data.autoStatus, 'review');

        // 验证集合等价（顺序无关）
        const r2 = LX.QuestionAPI.answer(2, ['C', 'A']);
        assertTrue(r2.data.correct, 'C,A 顺序无关应判对');

        // 多选多答（含错误项）应判错
        const r3 = LX.QuestionAPI.answer(2, ['A', 'B', 'C']);
        assertFalse(r3.data.correct, '含错误项应判错');
    });

    it('answer 填空大小写不敏感', () => {
        const r1 = LX.QuestionAPI.answer(4, '北京');
        assertTrue(r1.data.correct);

        const r2 = LX.QuestionAPI.answer(4, '  北京  ');
        assertTrue(r2.data.correct, '前后空格应忽略');

        const r3 = LX.QuestionAPI.answer(4, 'Beijing');
        assertFalse(r3.data.correct, '大小写不敏感但不等价翻译');
    });

    it('answer essay 不自动判分', () => {
        const r = LX.QuestionAPI.answer(5, '任意内容');
        assertOk(r);
        assertFalse(r.data.correct, 'essay 不自动判分');
        assertEqual(r.data.autoStatus, 'review', 'essay 默认 review');
        assertEqual(r.data.explanation, '解析');
    });

    // —— T1.2 ID 约定锁住：传 question 对象 vs 传裸 id 应等价 ——
    it('answer 传 question 对象与传裸 id 结果一致', () => {
        const q = LX.QuestionAPI.get(1).data;

        // 传 question 对象
        const rObj = LX.QuestionAPI.answer(q, 'B');
        assertOk(rObj);
        assertTrue(rObj.data.correct, '传对象应判对');

        // 传裸 id（向后兼容）
        const rId = LX.QuestionAPI.answer(1, 'B');
        assertOk(rId);
        assertTrue(rId.data.correct, '传 id 应判对');

        // 两者 autoStatus 一致
        assertEqual(rObj.data.autoStatus, rId.data.autoStatus);
    });

    it('ProgressAPI.getStatus 传 question 对象与传裸 id 结果一致', () => {
        const q = LX.QuestionAPI.get(1).data;
        LX.QuestionAPI.answer(q, 'B');  // 答对 → mastered

        const sObj = LX.ProgressAPI.getStatus(q);
        const sId = LX.ProgressAPI.getStatus(q.uid);
        assertEqual(sObj.data, sId.data, '传对象/传 id 应一致');
        assertEqual(sObj.data, 'mastered');
    });

    it('ProgressAPI.setStatus 传 question 对象与传裸 id 等价', () => {
        const q = LX.QuestionAPI.get(2).data;

        const r1 = LX.ProgressAPI.setStatus(q, 'review');
        assertOk(r1);
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'review');

        // 清除
        const r2 = LX.ProgressAPI.setStatus(q.uid, 'none');
        assertOk(r2);
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'none', '传裸 id 清除应生效');
    });
});
