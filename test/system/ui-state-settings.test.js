/**
 * 系统测：设置页进度 / 主题 / 导出 — 状态差分（含顶栏）
 * @module test/system/ui-state-settings.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue, assertOk } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    clickText, clearToastLog, installConfirmSpy, getConfirmLog,
    assertToastIncludes, assertDownloaded, assertNavigatedTo, clearNavigateLog,
} from '../ui/dom-harness.js';
import { createSettingsPage } from '../../src/render/pages/settings.js';
import { collectUiState, assertStateDelta } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';

describe('系统：UI 状态差分 · 设置', () => {
    /** @type {ReturnType<typeof mountShellWithPage> | null} */
    let ctx = null;

    function seed() {
        resetStateBeforeEach();
        createAndSwitchLibrary('设置差分库', [
            { id: 1, type: 'single', question: 'S1', options: ['a', 'b'], answer: 'A', category: 'X' },
            { id: 2, type: 'single', question: 'S2', options: ['a', 'b'], answer: 'A', category: 'X' },
            { id: 3, type: 'essay', question: 'S3', answer: '', category: 'Y' },
        ]);
        if (ctx) ctx.destroy();
        ctx = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
        clearToastLog();
    }

    function tear() {
        if (ctx) {
            ctx.destroy();
            ctx = null;
        }
    }

    it('SYS-SETTINGS-RESET-PROGRESS-TOPBAR：设置页重置同步顶栏 progressText', () => {
        seed();
        try {
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(2).data, 'review');
            ctx.refresh();
            const before = collectUiState(ctx.root);
            assertTrue((before.chrome.progressText || '').includes('1/'), before.chrome.progressText);
            assertEqual(before.chrome.wrongBadge, 1);

            clearToastLog();
            clickText(ctx.root, '重置当前题库进度');
            const after = collectUiState(ctx.root);
            assertStateDelta(before, after, {
                domain: { progress: { mastered: 0, review: 0 } },
                chrome: { wrongBadge: 0 },
                meta: { toastLastIncludes: '进度已重置' },
            });
            assertTrue((after.chrome.progressText || '').includes('0/3'), after.chrome.progressText);
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-RESET-CANCEL：取消重置顶栏与进度不变', () => {
        seed();
        try {
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            ctx.refresh();
            const before = collectUiState(ctx.root);
            const off = installConfirmSpy(false);
            clickText(ctx.root, '重置当前题库进度');
            assertTrue(getConfirmLog().length >= 1);
            const after = collectUiState(ctx.root);
            assertStateDelta(before, after, {}, ['domain.progress', 'chrome.progressText', 'chrome.wrongBadge']);
            off();
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-EXPORT-PROGRESS：备份进度产生下载且 domain 不变', () => {
        seed();
        try {
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            ctx.refresh();
            const before = collectUiState(ctx.root);
            clearToastLog();
            clickText(ctx.root, '备份进度');
            const after = collectUiState(ctx.root);
            assertDownloaded('progress-backup');
            assertToastIncludes('进度已备份');
            assertStateDelta(before, after, {}, ['domain.progress', 'chrome.progressText']);
            assertTrue(after.meta.downloads.some((f) => f.includes('progress-backup')));
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-THEME：切换主题写 data-theme + toast', () => {
        seed();
        try {
            clearToastLog();
            const red = ctx.root.querySelector('[title="红"]');
            assertTrue(!!red, '应有主题「红」');
            red.click();
            assertEqual(document.documentElement.getAttribute('data-theme'), 'red');
            assertToastIncludes('主题');
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-MODE-NIGHT：夜间模式 data-mode', () => {
        seed();
        try {
            clearToastLog();
            clickText(ctx.root, '夜间模式');
            assertEqual(document.documentElement.getAttribute('data-mode'), 'night');
            assertToastIncludes('模式');
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-DELETE-LIB-CANCEL：删除库取消 → libCount 不变', () => {
        seed();
        try {
            const LX = getLX();
            assertOk(LX.LibraryAPI.create('待删差分库', [
                { id: 1, type: 'essay', question: 'x', answer: '' },
            ], { skipDuplicateCheck: true }));
            ctx.remountPage(createSettingsPage);
            const before = collectUiState(ctx.root);
            const off = installConfirmSpy(false);
            // 找到「待删差分库」行附近的删除——点文案「删除」可能多个；用包含库名的区域
            const items = [...ctx.root.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '删除');
            assertTrue(items.length >= 1, '应有删除按钮');
            // 点最后一个（新建的通常在列表末）
            items[items.length - 1].click();
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.libCount, before.domain.libCount);
            off();
        } finally {
            tear();
        }
    });

    it('SYS-SETTINGS-OPEN-HELP：查看帮助 → navigate help', () => {
        seed();
        try {
            clearNavigateLog();
            clickText(ctx.root, '查看使用帮助');
            assertNavigatedTo('help');
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'settings', 'delta'] });
