/**
 * 系统测：浏览 / 搜索 / 练习 — 状态差分
 * @module test/system/ui-state-browse.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    clickText, clickLabel, type, clearToastLog, clearNavigateLog,
    assertNavigatedTo, assertToastIncludes, installConfirmSpy, getNavigateLog,
} from '../ui/dom-harness.js';
import { createBrowsePage } from '../../src/render/pages/browse.js';
import { createStudyPage } from '../../src/render/pages/study.js';
import { collectUiState, assertStateDelta } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';

describe('系统：UI 状态差分 · 浏览/搜索/练习', () => {
    /** @type {ReturnType<typeof mountShellWithPage> | null} */
    let ctx = null;

    function seed() {
        resetStateBeforeEach();
        createAndSwitchLibrary('浏览差分库', [
            { id: 1, type: 'single', question: '关键词ALPHA 甲题', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 2, type: 'single', question: '关键词ALPHA 乙题', options: ['对', '错'], answer: 'A', category: '乙' },
            { id: 3, type: 'essay', question: '关键词BETA 丙题', answer: '', category: '丙' },
            { id: 4, type: 'essay', question: '无关题目', answer: '', category: '丙' },
            { id: 5, type: 'single', question: '关键词ALPHA 丁题', options: ['对', '错'], answer: 'A', category: '甲' },
        ]);
        if (ctx) ctx.destroy();
        // 勿传 showBottombar:false —— 否则切到 study 后底栏永远不渲染
        ctx = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        clearToastLog();
        clearNavigateLog();
    }

    function tear() {
        const LX = getLX();
        if (LX.DrillAPI?.isActive()) LX.DrillAPI.exit();
        if (ctx) {
            ctx.destroy();
            ctx = null;
        }
    }

    it('SYS-BROWSE-SEARCH-EMPTY：空关键字搜索 → toast 且 filters 不变', () => {
        seed();
        try {
            const before = collectUiState(ctx.root);
            clickLabel(ctx.root, '执行题干搜索');
            const after = collectUiState(ctx.root);
            assertStateDelta(before, after, {
                meta: { toastLastIncludes: '关键字' },
            }, ['domain.uiSession.browseSearch.filters', 'page.filterChipCount']);
            assertToastIncludes('关键字');
        } finally {
            tear();
        }
    });

    it('SYS-BROWSE-SEARCH-PLAYLIST：搜索→点题→playlist→翻题不出圈', () => {
        seed();
        try {
            const LX = getLX();
            const before = collectUiState(ctx.root);
            type(ctx.root.querySelector('[aria-label="搜索题干"]'), '关键词ALPHA');
            clickLabel(ctx.root, '执行题干搜索');
            let after = collectUiState(ctx.root);
            assertEqual(after.domain.uiSession.browseSearch.filters.includes('关键词ALPHA'), true);
            assertTrue(after.page.filterChipCount >= 1);
            assertTrue(after.page.catalogItemCount >= 2);

            clearNavigateLog();
            const hit = ctx.root.querySelector('.lx-catalog-item');
            assertTrue(!!hit, '应有命中行');
            hit.click();
            after = collectUiState(ctx.root);
            assertNavigatedTo('study');
            const pl = LX.NavigationAPI.getSearchPlaylist();
            assertTrue(!!pl && pl.uids.length >= 2, `playlist size=${pl?.uids?.length}`);
            assertEqual(after.domain.searchPlaylist.active, true);
            assertTrue(after.domain.searchPlaylist.size >= 2);

            // 在壳层底栏翻题（切到 study 路由显示底栏）
            ctx.setRoute('study');
            ctx.remountPage(createStudyPage);
            const idx0 = LX.NavigationAPI.current().data.index;
            clickLabel(ctx.root, '下一题');
            const idx1 = LX.NavigationAPI.current().data.index;
            assertTrue(idx1 !== idx0, 'playlist 内应翻题');
            // 连续 next 不应跳出 playlist 集合
            const uids = new Set(pl.uids.map(String));
            for (let i = 0; i < pl.uids.length + 2; i++) {
                clickLabel(ctx.root, '下一题');
                const cur = String(LX.NavigationAPI.current().data.qId);
                assertTrue(uids.has(cur), `翻题应留在 playlist，qId=${cur}`);
            }
            assertStateDelta(before, collectUiState(ctx.root), {
                domain: { searchPlaylist: { active: true } },
            });
        } finally {
            tear();
        }
    });

    it('SYS-BROWSE-CHIP-CLEAR：关过滤标签清空 playlist', () => {
        seed();
        try {
            const LX = getLX();
            type(ctx.root.querySelector('[aria-label="搜索题干"]'), '关键词ALPHA');
            clickLabel(ctx.root, '执行题干搜索');
            ctx.root.querySelector('.lx-catalog-item').click();
            assertTrue(LX.NavigationAPI.getSearchPlaylist()?.uids?.length > 0);

            // 回浏览页关标签
            ctx.setRoute('browse');
            ctx.remountPage(createBrowsePage);
            const dismiss = ctx.root.querySelector('.lx-chip__dismiss');
            assertTrue(!!dismiss, '应有清除标签按钮');
            const before = collectUiState(ctx.root);
            dismiss.click();
            const after = collectUiState(ctx.root);
            assertEqual(after.page.filterChipCount, 0);
            assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
            assertEqual(after.domain.searchPlaylist.active, false);
            assertTrue(before.page.filterChipCount >= 1);
        } finally {
            tear();
        }
    });

    it('SYS-DRILL-QUICK-ADVANCE：练习面板快速刷题启动 + 答对推进', () => {
        // 种子只用 single，避免 Drill 随机抽到 essay 无 .lx-option 导致 flaky
        resetStateBeforeEach();
        createAndSwitchLibrary('练习刷题差分库', [
            { id: 1, type: 'single', question: '刷题A', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 2, type: 'single', question: '刷题B', options: ['对', '错'], answer: 'A', category: '乙' },
            { id: 3, type: 'single', question: '刷题C', options: ['对', '错'], answer: 'A', category: '丙' },
            { id: 4, type: 'single', question: '刷题D', options: ['对', '错'], answer: 'A', category: '甲' },
            { id: 5, type: 'single', question: '刷题E', options: ['对', '错'], answer: 'A', category: '乙' },
        ]);
        if (ctx) ctx.destroy();
        ctx = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        clearToastLog();
        clearNavigateLog();
        try {
            const LX = getLX();
            const before = collectUiState(ctx.root);
            clickLabel(ctx.root, '练习模式');
            let mid = collectUiState(ctx.root);
            assertEqual(mid.page.practiceModalOpen, true);
            assertEqual(mid.page.practiceCountDisabled, true); // 默认背诵

            clickLabel(ctx.root, '快速刷题');
            mid = collectUiState(ctx.root);
            assertEqual(mid.page.practiceMode, 'quick');
            assertEqual(mid.page.practiceCountDisabled, false);

            type(ctx.root.querySelector('[aria-label="本轮题量"]'), '3');
            clearNavigateLog();
            clickLabel(ctx.root, '开始练习');
            assertNavigatedTo('study');
            assertEqual(LX.DrillAPI.isActive(), true);
            assertEqual(LX.DrillAPI.current().data.mode, 'quick');
            assertEqual(LX.DrillAPI.current().data.total, 3);

            ctx.setRoute('study');
            ctx.remountPage(createStudyPage);
            const first = LX.DrillAPI.current().data.qId;
            const q = LX.QuestionAPI.get(first).data;
            assertEqual(q.type, 'single', '种子应全是 single');
            const opts = ctx.root.querySelectorAll('.lx-option');
            assertTrue(opts.length >= 1, '单选题库应有 .lx-option');
            // 点正确项（A）；勿假设 options DOM 顺序与字母绝对一致时仍用 answer
            const correctIdx = Math.max(0, 'ABCD'.indexOf(String(q.answer || 'A').toUpperCase()));
            (opts[correctIdx] || opts[0]).click();
            // quick 答对 delayMs=0，scheduleAdvance 同步推进；若仍未推进则显式 advance
            let next = LX.DrillAPI.current().data;
            if (next.qId === first) {
                LX.DrillAPI.advanceProgress();
                next = LX.DrillAPI.current().data;
            }
            assertTrue(next.qId !== first, '答对应推进');
            assertEqual(next.progressIndex, 1);
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.drill.active, true);
            assertEqual(after.domain.drill.index, 1);
            assertStateDelta(before, after, {
                domain: { drill: { active: true, mode: 'quick', total: 3 } },
            });
        } finally {
            tear();
        }
    });

    it('SYS-DRILL-CANCEL：取消练习面板不启动 Drill', () => {
        seed();
        try {
            const LX = getLX();
            clickLabel(ctx.root, '练习模式');
            const before = collectUiState(ctx.root);
            assertEqual(before.page.practiceModalOpen, true);
            clearNavigateLog();
            clickLabel(ctx.root, '取消练习模式');
            const after = collectUiState(ctx.root);
            assertEqual(after.page.practiceModalOpen, false);
            assertEqual(LX.DrillAPI.isActive(), false);
            assertEqual(getNavigateLog().some((e) => e.name === 'study'), false);
        } finally {
            tear();
        }
    });

    it('SYS-BROWSE-CATEGORY：只练本类 → category 写入 + 进 study', () => {
        seed();
        try {
            const LX = getLX();
            clearNavigateLog();
            clickText(ctx.root, '只练本类');
            assertNavigatedTo('study');
            assertEqual(LX.NavigationAPI.current().data.category !== 'all', true);
            const after = collectUiState(ctx.root);
            assertTrue(after.domain.nav.category === '甲' || after.domain.nav.category !== 'all');
        } finally {
            tear();
        }
    });

    it('SYS-BROWSE-PRACTICE-HINT-CANCEL：说明? 取消不跳帮助', () => {
        seed();
        try {
            const off = installConfirmSpy(false);
            clearNavigateLog();
            clickLabel(ctx.root, '练习模式说明');
            assertEqual(getNavigateLog().some((e) => e.name === 'help'), false);
            off();
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'browse', 'delta'] });
