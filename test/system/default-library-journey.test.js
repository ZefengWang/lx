import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertLength } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 系统旅程：加载示例题库 → 作答 → 错题本 → 跨分类 → 删除 → 重新加载（幂等）
 * 验证默认题库在完整用户旅程中的端到端正确性。
 */
describe('系统：默认题库完整旅程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('加载→作答→错题本→跨分类→删除→重新加载', () => {
        // 1. 加载示例题库（create + switch）
        const r = LX.DefaultLibraryAPI.loadDefault();
        assertOk(r, 'loadDefault 应成功');
        assertEqual(r.data.questionCount, 50);
        assertEqual(LX.LibraryAPI.current().data, r.data.id, '应已 switch 到新库');
        const libId = r.data.id;

        // 2. 第一题（single）作答对 → 标记掌握
        //    语文 id=1《红楼梦》作者 answer='B'（曹雪芹）
        const q1 = LX.QuestionAPI.get(1).data;
        assertTrue(!!q1, '第 1 题应存在');
        const ans1 = LX.QuestionAPI.answer(q1, 'B');
        assertOk(ans1);
        assertTrue(ans1.data.correct, '第 1 题答对应 correct');
        assertOk(LX.ProgressAPI.setStatus(q1, 'mastered', { libId, questions: [q1] }));
        const s1 = LX.StatsAPI.summary().data;
        assertEqual(s1.mastered, 1, '掌握数应为 1');

        // 3. 第二题（multi）作答错 → 进错题本 → 答对 → markMastered
        //    语文 id=2 唐宋八大家 answer='A,B,D'
        const q2 = LX.QuestionAPI.get(2).data;
        assertTrue(!!q2, '第 2 题应存在');
        const ans2wrong = LX.QuestionAPI.answer(q2, ['A']);
        assertTrue(!ans2wrong.data.correct, '多选答错应 correct=false');
        assertEqual(LX.WrongBookAPI.count().data, 1, '应入错题本');

        assertOk(LX.WrongBookAPI.enter(), '进入错题本模式');
        const ans2right = LX.QuestionAPI.answer(q2, ['A', 'B', 'D']);
        assertTrue(ans2right.data.correct, '多选答对应 correct');
        const mark = LX.WrongBookAPI.markMastered(q2);
        assertOk(mark);
        assertTrue(mark.data.cleared, '错题本应被清空');

        // 4. 跨分类：setCategory('语文') → 活动列表 5 题，next 不跨类
        LX.NavigationAPI.setCategory('语文');
        assertEqual(LX.NavigationAPI.getCategory(), '语文');
        const active = LX.NavigationAPI.getActiveList();
        assertOk(active);
        assertLength(active.data, 5, '语文 应有 5 题的活动列表');

        // next 3 次，current 仍在语文
        for (let i = 0; i < 3; i++) LX.NavigationAPI.next();
        const cur = LX.NavigationAPI.current();
        assertOk(cur);
        assertTrue(!!cur.data.qId, '应有当前题');
        const curQ = LX.QuestionAPI.get(cur.data.qId).data;
        assertTrue(!!curQ, '当前题应存在');
        assertEqual(curQ.category, '语文', '当前题应仍属语文分类');

        // 清掉分类筛选，恢复全库
        LX.NavigationAPI.setCategory(null);
        assertEqual(LX.NavigationAPI.getActiveList().data.length, 50, '清分类后应回到 50 题');

        // 5. 删除题库（用户强调：加载后能删除）
        const del = LX.LibraryAPI.delete(libId);
        assertOk(del, '删除应成功');
        assertEqual(LX.LibraryAPI.list().data.length, 0, '删除后列表为空');
        assertEqual(LX.LibraryAPI.current().data, null, 'current 应回到 null');
        assertEqual(LX.StatsAPI.summary().data.total, 0, '删除后 stats.total 应为 0');

        // 6. 重新加载（幂等性）
        const r2 = LX.DefaultLibraryAPI.loadDefault();
        assertOk(r2, '重新加载应成功');
        assertTrue(!r2.data.duplicateOf, '删除后重新加载应为全新创建');
        assertEqual(r2.data.questionCount, 50);
        assertEqual(LX.LibraryAPI.list().data.length, 1, '应又有一个库');
    });
}, { layer: 'system', tags: ['default-library', 'journey'] });
