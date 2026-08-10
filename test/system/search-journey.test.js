import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';
import { jumpToQuestionFromSearch } from '../../src/render/contracts/catalog-search.js';

describe('系统：题干搜索旅程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('建库→search 命中→跳转→current 题干一致→空串无结果', () => {
        createAndSwitchLibrary('搜索旅程库', [
            // v1 默认只搜题干：两道题干都含「夸美纽斯」；选项里的不算（除非 fields 含 options）
            { id: 1, type: 'single', question: '夸美纽斯被称作教育学之父', options: ['A.对', 'B.错'], answer: 'A', category: '教育' },
            { id: 2, type: 'single', question: '牛顿第一定律', options: ['A', 'B'], answer: 'A', category: '物理' },
            { id: 3, type: 'essay', question: '简述夸美纽斯贡献', answer: '', category: '教育' },
        ]);

        const hit = LX.QuestionAPI.search('夸美纽斯');
        assertOk(hit);
        assertEqual(hit.data.total, 2, '两道题干命中');

        const target = hit.data.questions.find((q) => q.type === 'essay');
        assertTrue(!!target);
        const jump = jumpToQuestionFromSearch(LX, target.uid, { keywords: ['夸美纽斯'] });
        assertOk(jump);
        assertEqual(jump.data.playlistTotal, 2);
        assertEqual(LX.NavigationAPI.current().data.total, 2);

        const cur = LX.NavigationAPI.current();
        assertOk(cur);
        const q = LX.QuestionAPI.get(cur.data.qId);
        assertOk(q);
        assertTrue(q.data.question.includes('夸美纽斯'));

        const empty = LX.QuestionAPI.search('');
        assertOk(empty);
        assertEqual(empty.data.total, 0);

        // 队列内翻题再 clear
        const before = LX.NavigationAPI.current().data.qId;
        assertOk(LX.NavigationAPI.next());
        assertTrue(LX.NavigationAPI.current().data.qId !== before
            || LX.NavigationAPI.current().data.total === 1);
        assertOk(LX.NavigationAPI.clearSearchPlaylist());
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
        assertEqual(LX.NavigationAPI.current().data.total, 3, '清队列后恢复全库');
    });
}, { layer: 'system', tags: ['search', 'e2e'] });
