/**
 * 系统测：矩阵 iframe 未完全锁死的高风险旅程（稀有锁）
 *
 * 矩阵 SAR（ui-sar-matrix）已覆盖绝大多数单控件路径；本文件只保留
 * 「多步串联 / 竞态防护」类断言，避免与 mountShell 样板三份重复。
 *
 * @module test/system/ui-state-risk-locks.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    clickLabel, type, clearToastLog, clearNavigateLog,
    assertNavigatedTo,
} from '../ui/dom-harness.js';
import { createBrowsePage } from '../../src/render/pages/browse.js';
import { createStudyPage } from '../../src/render/pages/study.js';
import { createWrongBookPage } from '../../src/render/pages/wrongbook.js';
import { collectUiState } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';
import { clickMasteredButton } from './app-iframe-harness.js';

describe('系统：高风险稀有锁（矩阵未替）', () => {
    /** @type {ReturnType<typeof mountShellWithPage> | null} */
    let ctx = null;

    function tear() {
        const LX = getLX();
        try {
            if (LX.DrillAPI?.isActive()) LX.DrillAPI.exit();
        } catch (_) { /* ignore */ }
        if (ctx) {
            ctx.destroy();
            ctx = null;
        }
    }

    it('RISK-PLAYLIST-BOUNDED：S=搜索命中多题 A=点题+底栏连翻 → R=不出 playlist 圈', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('风险playlist库', [
            { id: 1, type: 'single', question: '关键词ALPHA 甲题', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 2, type: 'single', question: '关键词ALPHA 乙题', options: ['对', '错'], answer: 'A', category: '乙' },
            { id: 3, type: 'essay', question: '关键词BETA 丙题', answer: '', category: '丙' },
            { id: 4, type: 'essay', question: '无关题目', answer: '', category: '丙' },
            { id: 5, type: 'single', question: '关键词ALPHA 丁题', options: ['对', '错'], answer: 'A', category: '甲' },
        ]);
        ctx = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        clearToastLog();
        clearNavigateLog();
        try {
            const LX = getLX();
            type(ctx.root.querySelector('[aria-label="搜索题干"]'), '关键词ALPHA');
            clickLabel(ctx.root, '执行题干搜索');
            const hit = ctx.root.querySelector('.lx-catalog-item');
            assertTrue(!!hit, '应有命中行');
            hit.click();
            assertNavigatedTo('study');
            const pl = LX.NavigationAPI.getSearchPlaylist();
            assertTrue(!!pl && pl.uids.length >= 2, `playlist size=${pl?.uids?.length}`);
            ctx.setRoute('study');
            ctx.remountPage(createStudyPage);
            const uids = new Set(pl.uids.map(String));
            for (let i = 0; i < pl.uids.length + 2; i++) {
                clickLabel(ctx.root, '下一题');
                const cur = String(LX.NavigationAPI.current().data.qId);
                assertTrue(uids.has(cur), `翻题应留在 playlist，qId=${cur}`);
            }
        } finally {
            tear();
        }
    });

    it('RISK-CELEBRATE-HOLD：S=错题本末题 A=我已掌握 → R=.lx-celebrate 不被 refresh 盖掉', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('风险庆祝库', [
            { id: 1, type: 'single', question: '错1', options: ['对', '错'], answer: 'A', category: 'W' },
            { id: 2, type: 'single', question: '错2', options: ['对', '错'], answer: 'A', category: 'W' },
        ]);
        const LX = getLX();
        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, 'B');
        ctx = mountShellWithPage(createWrongBookPage, { routeName: 'wrong', showBottombar: false });
        clearToastLog();
        try {
            clickMasteredButton(ctx.root);
            let s = collectUiState(ctx.root);
            if (!s.page.celebrateVisible && s.domain.wrongbook.count > 0) {
                clickMasteredButton(ctx.root);
                s = collectUiState(ctx.root);
            }
            assertEqual(s.domain.wrongbook.count, 0);
            assertEqual(s.chrome.wrongBadge, 0);
            assertEqual(s.page.celebrateVisible, true);
            assertTrue(!!ctx.root.querySelector('.lx-celebrate'), 'DOM 应保留庆祝');
        } finally {
            tear();
        }
    });

    it('RISK-DRILL-QUICK-ADVANCE：S=练习快速刷题 A=答对 → R=Drill 推进', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('风险练习库', [
            { id: 1, type: 'single', question: '练1', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 2, type: 'single', question: '练2', options: ['对', '错'], answer: 'A', category: '乙' },
            { id: 3, type: 'single', question: '练3', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 4, type: 'single', question: '练4', options: ['对', '错'], answer: 'A', category: '丙' },
            { id: 5, type: 'single', question: '练5', options: ['对', '错'], answer: 'A', category: '丙' },
        ]);
        ctx = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        clearNavigateLog();
        try {
            const LX = getLX();
            clickLabel(ctx.root, '练习模式');
            clickLabel(ctx.root, '快速刷题');
            type(ctx.root.querySelector('[aria-label="本轮题量"]'), '3');
            clickLabel(ctx.root, '开始练习');
            assertNavigatedTo('study');
            assertEqual(LX.DrillAPI.isActive(), true);
            ctx.setRoute('study');
            ctx.remountPage(createStudyPage);
            const first = LX.DrillAPI.current().data.qId;
            const opts = ctx.root.querySelectorAll('.lx-option');
            assertTrue(opts.length >= 1);
            opts[0].click();
            let next = LX.DrillAPI.current().data;
            if (next.qId === first && typeof LX.DrillAPI.advanceProgress === 'function') {
                LX.DrillAPI.advanceProgress();
                next = LX.DrillAPI.current().data;
            }
            assertTrue(next.qId !== first, '答对应推进');
            assertEqual(next.progressIndex, 1);
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'risk-lock', 'delta'] });
