import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 回归测试：锁住 v2.6.2 修复
 *
 * Bug 复现路径（v2.6.2 之前）：
 *   多选题故意做错 → 进入错题本 → 确认答案后不显示答对/答错反馈
 *   且多选计数异常（"已选 13 项"）
 *
 * 根因：
 *   wrongbook.js handleAnswer 的 multi 分支未调用 QuestionAPI.answer，
 *   无判分和 toast 反馈；且将整个答案数组 append 导致计数爆炸
 *
 * 修复：
 *   重写 multi 分支：opts.commit=true 时直接用排序后的数组提交，
 *   调 QuestionAPI.answer 判分，revealed.add 高亮，答对则移出。
 * v3.0.2：移出必须走 WrongBookAPI.markMastered（方案 B），才能清完自动 exit + CLEARED。
 */
describe('回归：错题本多选题流程（v2.6.2 修复）', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('S=多选做错进错题本 A=做对+markMastered → R=自动移出+CLEARED', () => {
        // 1. 创建题库，含 1 道多选题（正确答案 A,C）
        const r = LX.LibraryAPI.create('多选错题回归库', [
            { id: 1, type: 'multi', question: '多选：下列哪些是水果？', options: ['A.苹果', 'B.桌子', 'C.香蕉', 'D.椅子'], answer: 'A,C', explanation: '苹果和香蕉是水果' },
        ]);
        assertOk(r);
        LX.LibraryAPI.switch(r.data.id);

        // 2. 故意答错（选 A,B,D，正确是 A,C）
        const wrongAns = LX.QuestionAPI.answer(1, ['A', 'B', 'D']);
        assertOk(wrongAns);
        assertFalse(wrongAns.data.correct, '答错应 correct=false');
        assertEqual(wrongAns.data.autoStatus, 'review', '答错应自动入错题');

        // 验证进度
        const q = LX.QuestionAPI.get(1).data;
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'review');

        // 3. 确认错题数 = 1
        assertEqual(LX.WrongBookAPI.count().data, 1, '应有 1 道错题');

        // 4. 进入错题专注模式
        const enterR = LX.WrongBookAPI.enter();
        assertOk(enterR);
        assertEqual(enterR.data.wrongCount, 1);

        // navigation 应只见 1 道错题
        assertEqual(LX.NavigationAPI.current().data.total, 1);

        // 5. 在错题本模式下，用正确答案（数组）重新作答
        //    模拟 UI 层 commit 提交：传排序后的数组
        const correctAns = ['A', 'C'];
        const reAns = LX.QuestionAPI.answer(q, correctAns);
        assertOk(reAns);
        assertTrue(reAns.data.correct, 'A,C 应判对');

        // autoStatus 返回建议值 'mastered'（答对），但 isWrongBookMode 守卫阻止自动 setStatus
        assertEqual(reAns.data.autoStatus, 'mastered', 'autoStatus 应建议 mastered');
        // 验证状态未被自动改（仍为 review，因为错题本模式守卫）
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'review', '错题本模式不应自动改状态');

        // 6. UI 层显式标记掌握（方案 B：模拟 wrongbook.js / wrongbook-flow 契约）
        let clearedPayload = null;
        LX.on(LX.Events.WRONGBOOK_CLEARED, (p) => { clearedPayload = p; });
        const markR = LX.WrongBookAPI.markMastered(q);
        assertOk(markR);
        assertTrue(markR.data.cleared, '最后一题 markMastered 应 cleared');
        assertTrue(clearedPayload, '应触发 WRONGBOOK_CLEARED');

        // 7. 验证已从错题本移出 + 已自动 exit（无需再手动 exit）
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'mastered');
        assertEqual(LX.WrongBookAPI.count().data, 0, '错题数应归零');
        assertEqual(LX.NavigationAPI.current().data.total, 1, '自动退出后恢复全量');
    });

    it('S=多选数组作答 A=answer → R=计数=1 不爆炸（修复后）', () => {
        // 锁住 v2.6.2 修复：确认答案时直接用数组，不嵌套 append
        const r = LX.LibraryAPI.create('多选计数库', [
            { id: 1, type: 'multi', question: '多选', options: ['A', 'B', 'C', 'D'], answer: 'A,B,C', explanation: '' },
            { id: 2, type: 'multi', question: '多选2', options: ['A', 'B', 'C', 'D'], answer: 'A,B', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);

        // 题1 答对：传数组 ['A','B','C']
        const r1 = LX.QuestionAPI.answer(1, ['A', 'B', 'C']);
        assertTrue(r1.data.correct, 'A,B,C 应判对');

        // 题2 答错：传数组 ['A','B','C']（正确是 A,B）
        const r2 = LX.QuestionAPI.answer(2, ['A', 'B', 'C']);
        assertFalse(r2.data.correct, '多选多答应判错');

        // 验证错题数 = 1（不是 3、13 等异常值）
        assertEqual(LX.WrongBookAPI.count().data, 1, '错题计数应为 1，不应爆炸');
    });

    it('S=多选乱序/逗号串 A=answer → R=判对（修复后）', () => {
        const r = LX.LibraryAPI.create('多选顺序库', [
            { id: 1, type: 'multi', question: '多选', options: ['A', 'B', 'C', 'D'], answer: 'A,C,D', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);

        // 正序
        const r1 = LX.QuestionAPI.answer(1, ['A', 'C', 'D']);
        assertTrue(r1.data.correct, '正序 A,C,D 应判对');

        // 乱序
        const r2 = LX.QuestionAPI.answer(1, ['D', 'A', 'C']);
        assertTrue(r2.data.correct, '乱序 D,A,C 应判对');

        // 逗号字符串也兼容
        const r3 = LX.QuestionAPI.answer(1, 'C,A,D');
        assertTrue(r3.data.correct, '逗号字符串 C,A,D 应判对');
    });

    it('S=错题本 multi A=做错→enter→做对+markMastered → R=cleared+exit', () => {
        // 端到端：只有 1 道多选错题，做对后应自动 exit + WRONGBOOK_CLEARED
        const r = LX.LibraryAPI.create('单题多选库', [
            { id: 1, type: 'multi', question: '多选', options: ['A', 'B', 'C'], answer: 'A,B', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);

        // 答错
        LX.QuestionAPI.answer(1, ['A', 'C']);
        assertEqual(LX.WrongBookAPI.count().data, 1);

        // 进入错题模式
        LX.WrongBookAPI.enter();

        // 监听 cleared 事件
        let cleared = null;
        LX.on(LX.Events.WRONGBOOK_CLEARED, (p) => { cleared = p; });

        // 答对 + markMastered（正确 API：会检查 remaining，若为 0 则自动 exit + cleared）
        const q = LX.QuestionAPI.get(1).data;
        const ansR = LX.QuestionAPI.answer(q, ['A', 'B']);
        assertTrue(ansR.data.correct);

        // 错题本模式 answer 不自动设状态 → 用 markMastered 显式标记
        const markR = LX.WrongBookAPI.markMastered(q);
        assertOk(markR);
        assertTrue(markR.data.cleared, '最后一题应触发 cleared');

        // 验证 WRONGBOOK_CLEARED 事件已触发
        assertTrue(cleared, '应触发 WRONGBOOK_CLEARED 事件');

        // markMastered 已自动 exit
        assertEqual(LX.NavigationAPI.current().data.total, 1, '自动退出后恢复全量');
    });
});
