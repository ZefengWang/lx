import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';
import { jumpToQuestionFromSearch } from '../../src/render/contracts/catalog-search.js';

describe('UI 契约：浏览搜索跳转', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('点命中进入 searchPlaylist，total=命中数', () => {
        createAndSwitchLibrary('跳转库', [
            { id: 1, type: 'essay', question: '第一题 AAA', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '第二题 BBB', answer: '', category: 'B' },
            { id: 3, type: 'essay', question: '第三题 AAA 也有', answer: '', category: 'A' },
        ]);
        const q1 = LX.QuestionAPI.get(1).data;
        const r = jumpToQuestionFromSearch(LX, q1.uid, { keywords: ['AAA'] });
        assertOk(r);
        assertEqual(r.data.playlistTotal, 2);
        const pl = LX.NavigationAPI.getSearchPlaylist();
        assertTrue(!!pl && pl.uids.length === 2);
        assertEqual(LX.NavigationAPI.current().data.total, 2);
        assertEqual(LX.NavigationAPI.current().data.qId, q1.uid);
    });

    it('只练本类时跳转：playlist 仅该类命中，且保留分类上下文', () => {
        createAndSwitchLibrary('分类跳转库', [
            { id: 1, type: 'essay', question: '甲类题 KEY', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: '乙类题 KEY', answer: '', category: '乙' },
            { id: 3, type: 'essay', question: '甲类题 KEY 其二', answer: '', category: '甲' },
        ]);
        assertOk(LX.NavigationAPI.setCategory('甲'));
        const q1 = LX.QuestionAPI.get(1).data;
        const r = jumpToQuestionFromSearch(LX, q1.uid, {
            keywords: ['KEY'],
            category: '甲',
        });
        assertOk(r);
        assertEqual(r.data.playlistTotal, 2, '只应含甲类两道 KEY');
        assertEqual(r.data.clearedFilters, false, '不应清掉只练本类');
        assertEqual(r.data.scopedCategory, '甲');
        assertEqual(LX.NavigationAPI.getCategory(), '甲', '跳转后分类上下文仍在');
        assertEqual(LX.NavigationAPI.getSearchPlaylist().uids.length, 2);
    });

    it('只练本类时目标在其他类 → NOT_FOUND', () => {
        createAndSwitchLibrary('跨类拒跳', [
            { id: 1, type: 'essay', question: '甲 KEY', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: '乙 KEY', answer: '', category: '乙' },
        ]);
        assertOk(LX.NavigationAPI.setCategory('甲'));
        const q2 = LX.QuestionAPI.get(2).data;
        const r = jumpToQuestionFromSearch(LX, q2.uid, {
            keywords: ['KEY'],
            category: '甲',
        });
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'NOT_FOUND');
        assertEqual(LX.NavigationAPI.getCategory(), '甲');
    });

    it('缺 keywords → INVALID_INPUT；无命中 → NOT_FOUND', () => {
        createAndSwitchLibrary('跳转失败库', [
            { id: 1, type: 'essay', question: '有题', answer: '', category: 'A' },
        ]);
        const q = LX.QuestionAPI.get(1).data;
        const noKw = jumpToQuestionFromSearch(LX, q.uid, {});
        assertEqual(noKw.ok, false);
        assertEqual(noKw.error.code, 'INVALID_INPUT');
        const miss = jumpToQuestionFromSearch(LX, q.uid, { keywords: ['根本不存在的词XYZ'] });
        assertEqual(miss.ok, false);
        assertEqual(miss.error.code, 'NOT_FOUND');
    });

    it('目标 uid 不在命中集 → NOT_FOUND', () => {
        createAndSwitchLibrary('跳转错位库', [
            { id: 1, type: 'essay', question: '命中 AAA', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '未命中', answer: '', category: 'B' },
        ]);
        const q2 = LX.QuestionAPI.get(2).data;
        const r = jumpToQuestionFromSearch(LX, q2.uid, { keywords: ['AAA'] });
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'NOT_FOUND');
    });
}, { layer: 'ui', tags: ['search', 'contract'] });
