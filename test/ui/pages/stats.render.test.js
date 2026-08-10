import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createStatsPage } from '../../../src/render/pages/stats.js';
import { mountPage, assertTextIncludes, preserveHash } from '../dom-harness.js';

describe('UI 渲染：统计页 stats（无可点主按钮，锁文案）', () => {
    let mounted;
    let restoreHash;

    beforeEach(async () => {
        await resetStateBeforeEach();
        restoreHash = preserveHash();
        createAndSwitchLibrary('统计测库', [
            { id: 1, type: 'single', question: '统计题', options: ['A', 'B'], answer: 'A', category: '统' },
        ]);
        getLX().QuestionAPI.answer(1, 'A');
        mounted = mountPage(createStatsPage);
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        if (restoreHash) restoreHash();
    });

    it('展示掌握/错题等统计信息', () => {
        assertTextIncludes(mounted.root, /掌握|统计|题目|进度|%|已掌握/);
    });
}, { layer: 'ui', tags: ['render', 'stats'] });
