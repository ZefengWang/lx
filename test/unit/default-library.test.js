import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertLength, assertContains } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';
import {
    DEFAULT_QUESTIONS,
    DEFAULT_LIBRARY_NAME,
} from '../../src/api/default-library.js';

/**
 * DefaultLibraryAPI 单元测试
 * 覆盖：loadDefault 三种结果 / 元数据 / 题型齐全 / 字段归一化 / 加载后删除 / 分类与统计
 */
describe('DefaultLibraryAPI', () => {
    beforeEach(resetStateBeforeEach);

    // 1. loadDefault 成功
    it('loadDefault() 成功：返回 id/name/questionCount=50/switched=true', () => {
        const LX = getLX();
        const r = LX.DefaultLibraryAPI.loadDefault();
        assertOk(r, 'loadDefault 应成功');
        assertEqual(r.data.questionCount, 50, '题量应为 50');
        assertEqual(r.data.name, DEFAULT_LIBRARY_NAME);
        assertEqual(r.data.switched, true, '默认应自动 switch');
        assertTrue(!!r.data.id, '应返回 id');
        assertTrue(!r.data.duplicateOf, '首次加载不应是重复');
    });

    // 2. 加载后 current 等于新 id
    it('加载后 current() 等于新 id（switched 默认 true）', () => {
        const LX = getLX();
        const r = LX.DefaultLibraryAPI.loadDefault();
        const cur = LX.LibraryAPI.current();
        assertOk(cur);
        assertEqual(cur.data, r.data.id, 'current 应指向新加载的题库');
    });

    // 3. switchAfterCreate:false → current 不变
    it('switchAfterCreate:false → 加载后 current() 不变', () => {
        const LX = getLX();
        // 先建一个库并 switch 过去，作为"原 current"
        const base = LX.LibraryAPI.create('原库', [
            { id: 1, type: 'essay', question: 'q', answer: '', explanation: '' },
        ]);
        LX.LibraryAPI.switch(base.data.id);
        const before = LX.LibraryAPI.current().data;

        const r = LX.DefaultLibraryAPI.loadDefault({ switchAfterCreate: false });
        assertOk(r);
        assertEqual(r.data.switched, false, 'switched 应为 false');
        const after = LX.LibraryAPI.current().data;
        assertEqual(after, before, 'current 不应变');
    });

    // 4. 默认 skipDuplicateCheck:false → 重复加载返回 duplicateOf
    it('重复加载（默认去重）→ data.duplicateOf 指向已存在库', () => {
        const LX = getLX();
        const r1 = LX.DefaultLibraryAPI.loadDefault();
        const firstId = r1.data.id;

        // 清掉 current 指向以便观察，但库还在
        const r2 = LX.DefaultLibraryAPI.loadDefault();
        assertOk(r2, '重复加载应返回 ok:true（不是 error）');
        assertTrue(!!r2.data.duplicateOf, '应有 duplicateOf');
        assertEqual(r2.data.duplicateOf, firstId, 'duplicateOf 应指向首个库');
        assertEqual(r2.data.id, firstId, 'id 应等于已存在库 id');
    });

    // 5. skipDuplicateCheck:true → 重复加载创建第二个题库
    it('skipDuplicateCheck:true → 重复加载创建第二个题库（list 长度+1）', () => {
        const LX = getLX();
        LX.DefaultLibraryAPI.loadDefault();
        const lenBefore = LX.LibraryAPI.list().data.length;

        const r = LX.DefaultLibraryAPI.loadDefault({ skipDuplicateCheck: true });
        assertOk(r);
        assertTrue(!r.data.duplicateOf, '强制创建不应有 duplicateOf');
        const lenAfter = LX.LibraryAPI.list().data.length;
        assertEqual(lenAfter, lenBefore + 1, '题库数应 +1');
    });

    // 6. 元数据 questionCount
    it('getDefaultLibraryMeta().questionCount === 50', () => {
        const LX = getLX();
        const meta = LX.DefaultLibraryAPI.getDefaultLibraryMeta();
        assertEqual(meta.questionCount, 50);
        assertEqual(meta.name, DEFAULT_LIBRARY_NAME);
    });

    // 7. 元数据 subjectCount
    it('getDefaultLibraryMeta().subjectCount === 10', () => {
        const LX = getLX();
        const meta = LX.DefaultLibraryAPI.getDefaultLibraryMeta();
        assertEqual(meta.subjectCount, 10, '应有 10 个学科分类');
        assertLength(meta.subjects, 10);
    });

    // 8. 每分类 5 题型齐全
    it('每分类覆盖 single/multi/judge/fill/essay 五种题型', () => {
        const LX = getLX();
        const meta = LX.DefaultLibraryAPI.getDefaultLibraryMeta();
        const TYPES = ['single', 'multi', 'judge', 'fill', 'essay'];
        for (const subject of meta.subjects) {
            const qs = DEFAULT_QUESTIONS.filter((q) => q.category === subject);
            assertLength(qs, 5, `${subject} 应有 5 题`);
            const types = new Set(qs.map((q) => q.type));
            for (const t of TYPES) {
                assertTrue(types.has(t), `${subject} 缺少题型 ${t}`);
            }
        }
    });

    // 9. 题目字段归一化
    it('加载后题目字段归一化（uid/displayId/type/answer/question）', () => {
        const LX = getLX();
        const r = LX.DefaultLibraryAPI.loadDefault();
        const lib = LX.LibraryAPI.get(r.data.id);
        assertOk(lib);
        const q0 = lib.data.questions[0];
        assertTrue(q0.uid != null, '应有 uid');
        assertTrue(q0.displayId != null, '应有 displayId');
        assertTrue(typeof q0.type === 'string' && q0.type.length > 0, '应有 type');
        assertTrue(typeof q0.question === 'string' && q0.question.length > 0, '应有 question');
        assertTrue('answer' in q0, '应有 answer 字段');
    });

    // 10. 加载后能删除（用户强调）
    it('加载后能删除：delete 成功，list 不含，current 回到 null', () => {
        const LX = getLX();
        const r = LX.DefaultLibraryAPI.loadDefault();
        const id = r.data.id;

        const del = LX.LibraryAPI.delete(id);
        assertOk(del, 'delete 应成功');

        const list = LX.LibraryAPI.list().data;
        assertTrue(!list.some((l) => l.id === id), 'list 不应再含该库');

        const cur = LX.LibraryAPI.current();
        assertOk(cur);
        assertEqual(cur.data, null, 'current 应回到 null');
    });

    // 11. 加载后分类列表正确
    it('加载后 CategoryAPI.list() 含 10 个分类名', () => {
        const LX = getLX();
        LX.DefaultLibraryAPI.loadDefault();
        const cats = LX.CategoryAPI.list();
        assertOk(cats);
        assertLength(cats.data, 10, '应有 10 个分类');
        const names = cats.data.map((c) => c.name);
        assertContains(names, '语文');
        assertContains(names, '职业常识');
    });

    // 12. 加载后 stats 一致
    it('加载后 StatsAPI.summary() 一致：total=50 / mastered=0 / review=0', () => {
        const LX = getLX();
        LX.DefaultLibraryAPI.loadDefault();
        const s = LX.StatsAPI.summary();
        assertOk(s);
        assertEqual(s.data.total, 50, 'total 应为 50');
        assertEqual(s.data.mastered, 0, '初始 mastered 应为 0');
        assertEqual(s.data.review, 0, '初始 review 应为 0');
    });
}, { layer: 'api', tags: ['default-library'] });
