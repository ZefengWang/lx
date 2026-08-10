import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertErr } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

describe('QuestionAPI.search 题干搜索', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('题干命中', () => {
        createAndSwitchLibrary('搜索库', [
            { id: 1, type: 'single', question: '马克思主义基本原理', options: ['A', 'B'], answer: 'A', category: '政治' },
            { id: 2, type: 'single', question: '高等数学极限', options: ['A', 'B'], answer: 'A', category: '数学' },
        ]);
        const r = LX.QuestionAPI.search('马克思');
        assertOk(r);
        assertEqual(r.data.total, 1);
        assertEqual(r.data.questions[0].question.includes('马克思'), true);
    });

    it('大小写不敏感', () => {
        createAndSwitchLibrary('搜索库大小写', [
            { id: 1, type: 'essay', question: 'What is Java runtime?', answer: '', category: 'CS' },
        ]);
        const r = LX.QuestionAPI.search('java');
        assertOk(r);
        assertEqual(r.data.total, 1);
    });

    it('空串返回空结果', () => {
        createAndSwitchLibrary('搜索库空', [
            { id: 1, type: 'essay', question: '任意题干', answer: '', category: 'A' },
        ]);
        const r = LX.QuestionAPI.search('   ');
        assertOk(r);
        assertEqual(r.data.total, 0);
        assertEqual(r.data.questions.length, 0);
    });

    it('limit 截断 questions，total 仍为命中总数', () => {
        const qs = [];
        for (let i = 1; i <= 60; i++) {
            qs.push({
                id: i,
                type: 'essay',
                question: `公共前缀关键字 ALPHA 题号${i}`,
                answer: '',
                category: '批',
            });
        }
        createAndSwitchLibrary('搜索库 limit', qs);
        const r = LX.QuestionAPI.search('ALPHA');
        assertOk(r);
        assertEqual(r.data.total, 60);
        assertEqual(r.data.questions.length, 50, '默认 limit=50');
        const r2 = LX.QuestionAPI.search('ALPHA', { limit: 10 });
        assertEqual(r2.data.questions.length, 10);
        assertEqual(r2.data.total, 60);
    });

    it('S=60 命中 A=offset=50 limit=50 → R=余下 10 题', () => {
        const qs = [];
        for (let i = 1; i <= 60; i++) {
            qs.push({
                id: i,
                type: 'essay',
                question: `OFFSETKEY 题号${i}`,
                answer: '',
                category: '批',
            });
        }
        createAndSwitchLibrary('搜索库 offset', qs);
        const page1 = LX.QuestionAPI.search('OFFSETKEY', { limit: 50, offset: 0 });
        assertOk(page1);
        assertEqual(page1.data.questions.length, 50);
        const page2 = LX.QuestionAPI.search('OFFSETKEY', { limit: 50, offset: 50 });
        assertOk(page2);
        assertEqual(page2.data.total, 60);
        assertEqual(page2.data.questions.length, 10);
    });

    it('与 category 组合', () => {
        createAndSwitchLibrary('搜索库分类', [
            { id: 1, type: 'essay', question: '共同关键字 甲', answer: '', category: '语文' },
            { id: 2, type: 'essay', question: '共同关键字 乙', answer: '', category: '数学' },
        ]);
        const r = LX.QuestionAPI.search('共同关键字', { category: '语文' });
        assertOk(r);
        assertEqual(r.data.total, 1);
        assertEqual(r.data.questions[0].category, '语文');
    });

    it('与 status 组合', () => {
        createAndSwitchLibrary('搜索库状态', [
            { id: 1, type: 'single', question: '状态关键字一', options: ['A', 'B'], answer: 'A', category: 'X' },
            { id: 2, type: 'single', question: '状态关键字二', options: ['A', 'B'], answer: 'A', category: 'X' },
        ]);
        LX.QuestionAPI.answer(1, 'A'); // mastered
        LX.QuestionAPI.answer(2, 'B'); // review
        const r = LX.QuestionAPI.search('状态关键字', { status: 'review' });
        assertOk(r);
        assertEqual(r.data.total, 1);
        assertTrue(r.data.questions[0].question.includes('二'));
    });

    it('未选题库返回空', () => {
        // reset 后无 currentLibId
        const r = LX.QuestionAPI.search('任意');
        assertOk(r);
        assertEqual(r.data.total, 0);
    });

    it('无效 fields 返回 INVALID_INPUT', () => {
        createAndSwitchLibrary('搜索库字段', [
            { id: 1, type: 'essay', question: '题', answer: '', category: 'A' },
        ]);
        const r = LX.QuestionAPI.search('题', { fields: ['nope'] });
        assertErr(r, 'INVALID_INPUT');
    });

    it('S=关键字仅在选项 A=fields 含 options → R=命中；默认只搜题干不命中', () => {
        createAndSwitchLibrary('搜索库选项', [
            { id: 1, type: 'single', question: '题干无关键字', options: ['含OPTKEY的选项', 'B'], answer: 'A', category: 'A' },
        ]);
        const def = LX.QuestionAPI.search('OPTKEY');
        assertOk(def);
        assertEqual(def.data.total, 0, '默认不搜选项');
        const r = LX.QuestionAPI.search('OPTKEY', { fields: ['options'] });
        assertOk(r);
        assertEqual(r.data.total, 1);
    });

    it('S=库含只A/只B/A且B A=keywords=[A,B] → R=仅双含', () => {
        createAndSwitchLibrary('搜索库 AND', [
            { id: 1, type: 'essay', question: '只有AAA词', answer: '', category: 'X' },
            { id: 2, type: 'essay', question: '只有BBB词', answer: '', category: 'X' },
            { id: 3, type: 'essay', question: '同时含AAA与BBB', answer: '', category: 'Y' },
        ]);
        const r = LX.QuestionAPI.search('', { keywords: ['AAA', 'BBB'] });
        assertOk(r);
        assertEqual(r.data.total, 1);
        assertTrue(r.data.questions[0].question.includes('同时含'));
    });

    it('S=同上 A=keywords=[AAA,CCC] → R=A∩C；keyword 数组形式等价', () => {
        createAndSwitchLibrary('搜索库 AND2', [
            { id: 1, type: 'essay', question: 'AAA 与 CCC 双含', answer: '', category: 'X' },
            { id: 2, type: 'essay', question: 'AAA 与 BBB', answer: '', category: 'X' },
            { id: 3, type: 'essay', question: '仅 CCC', answer: '', category: 'X' },
        ]);
        const r = LX.QuestionAPI.search('', { keywords: ['AAA', 'CCC'] });
        assertOk(r);
        assertEqual(r.data.total, 1);
        const r2 = LX.QuestionAPI.search(['AAA', 'CCC']);
        assertOk(r2);
        assertEqual(r2.data.total, 1);
    });

    it('S=空 terms A=search → R=total=0', () => {
        createAndSwitchLibrary('搜索库空 terms', [
            { id: 1, type: 'essay', question: '任意', answer: '', category: 'A' },
        ]);
        const r = LX.QuestionAPI.search(['', '  ']);
        assertOk(r);
        assertEqual(r.data.total, 0);
    });
}, { layer: 'api', tags: ['search', 'unit'] });
