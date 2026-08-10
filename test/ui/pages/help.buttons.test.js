import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { resetStateBeforeEach } from '../../helpers.js';
import {
    createHelpPage,
    openHelpSection,
    __clearHighlightLogForTest,
    __getHighlightLogForTest,
    __highlightSectionForTest,
} from '../../../src/render/pages/help.js';
import {
    mountPage, clickText, assertTextIncludes, preserveHash, assertNavigatedTo, clearNavigateLog,
} from '../dom-harness.js';

/**
 * SAR：帮助页导航 + 章节高亮（含未知 section 失败对照）
 */
describe('UI 按钮：帮助页 help', () => {
    let mounted;
    let restoreHash;

    beforeEach(async () => {
        await resetStateBeforeEach();
        restoreHash = preserveHash();
        __clearHighlightLogForTest();
        mounted = mountPage(createHelpPage);
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        __clearHighlightLogForTest();
    });

    it('渲染帮助内容', () => {
        assertTextIncludes(mounted.root, '使用帮助');
        assertTextIncludes(mounted.root, '练习模式');
        assertTextIncludes(mounted.root, '快速刷题');
        assertTextIncludes(mounted.root, '背诵记忆');
        assertTextIncludes(mounted.root, '过滤标签');
        assertTrue(!!mounted.root.querySelector('[data-help-section="practice-mode"]'));
    });

    it('点击「去刷题」→ navigate study', () => {
        clickText(mounted.root, '去刷题');
        assertNavigatedTo('study');
    });

    it('点击「开始刷题」→ navigate study', () => {
        mounted.destroy();
        mounted = mountPage(createHelpPage);
        clickText(mounted.root, '开始刷题');
        assertNavigatedTo('study');
    });

    it('点击「前往设置」→ navigate settings', () => {
        mounted.destroy();
        mounted = mountPage(createHelpPage);
        clickText(mounted.root, '前往设置');
        assertNavigatedTo('settings');
    });

    it('S=已渲染 A=__highlightSectionForTest(practice-mode) → R=日志+flash class', () => {
        __clearHighlightLogForTest();
        const ok = __highlightSectionForTest('practice-mode');
        assertEqual(ok, true);
        const log = __getHighlightLogForTest();
        assertEqual(log.length, 1);
        assertEqual(log[0].id, 'practice-mode');
        const el = mounted.root.querySelector('[data-help-section="practice-mode"]');
        assertTrue(!!el);
        assertTrue(el.classList.contains('lx-help-flash'), '应加上高亮 class');
    });

    it('S=pending A=openHelpSection 后 remount → R=高亮 practice-mode', async () => {
        __clearHighlightLogForTest();
        clearNavigateLog();
        openHelpSection('practice-mode');
        assertNavigatedTo('help');
        mounted.destroy();
        mounted = mountPage(createHelpPage);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const log = __getHighlightLogForTest();
        assertTrue(log.some((e) => e.id === 'practice-mode'), '应记录高亮');
        const el = mounted.root.querySelector('[data-help-section="practice-mode"]');
        assertTrue(!!el && el.classList.contains('lx-help-flash'));
    });

    it('S=已渲染 A=__highlightSectionForTest(未知 id) → R=false 且无 flash', () => {
        __clearHighlightLogForTest();
        const ok = __highlightSectionForTest('no-such-section');
        assertEqual(ok, false);
        assertEqual(__getHighlightLogForTest().length, 0);
        const flashed = mounted.root.querySelector('.lx-help-flash');
        assertEqual(flashed, null);
    });

    it('S=空 sectionId A=openHelpSection → R=仍 navigate help（不崩溃）', () => {
        clearNavigateLog();
        openHelpSection('');
        assertNavigatedTo('help');
    });
}, { layer: 'ui', tags: ['buttons', 'help'] });
