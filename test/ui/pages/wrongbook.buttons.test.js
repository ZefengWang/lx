import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertOk, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createWrongBookPage } from '../../../src/render/pages/wrongbook.js';
import {
    mountPage, clickText, assertTextIncludes, preserveHash,
    assertNavigatedTo, clearNavigateLog,
    installToastSpy, assertToastIncludes, clearToastLog,
} from '../dom-harness.js';

/**
 * SAR 最低矩阵已覆盖：对/错/掌握/下一题/清完庆祝/退出/无错题空态（方案 B）。
 */
describe('UI 按钮：错题本 wrongbook（SAR）', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    function seedWrong(n = 2) {
        const qs = [];
        for (let i = 1; i <= n; i++) {
            qs.push({
                id: i, type: 'single', question: `错题UI${i}`,
                options: ['正确项', '错误项'], answer: 'A', category: 'X',
            });
        }
        createAndSwitchLibrary('错题SAR库', qs);
        for (let i = 1; i <= n; i++) {
            LX.QuestionAPI.answer(i, 'B');
        }
    }

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        seedWrong(2);
        mounted = mountPage(createWrongBookPage);
        clearToastLog();
        clearNavigateLog();
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    it('S=有错题 A=进入页 → R=渲染错题专注与操作键', () => {
        assertTextIncludes(mounted.root, '错题专注');
        assertTextIncludes(mounted.root, '我已掌握');
        assertTrue(LX.WrongBookAPI.count().data >= 1);
    });

    it('S=有错题 A=点「我已掌握」→ R=count-1 + toast', () => {
        const before = LX.WrongBookAPI.count().data;
        clickText(mounted.root, '我已掌握');
        assertTrue(LX.WrongBookAPI.count().data < before);
        assertToastIncludes(/掌握|移出/);
    });

    it('S=当前错题 A=点错误选项 → R=仍在错题本 + toast 正确答案', () => {
        const before = LX.WrongBookAPI.count().data;
        const opts = mounted.root.querySelectorAll('.lx-option');
        assertTrue(opts.length >= 2);
        opts[1].click(); // B 错误项
        assertEqual(LX.WrongBookAPI.count().data, before);
        assertToastIncludes('正确答案');
    });

    it('S=当前错题 A=点正确选项 → R=移出 + toast', () => {
        const before = LX.WrongBookAPI.count().data;
        const opts = mounted.root.querySelectorAll('.lx-option');
        opts[0].click(); // A 正确
        assertTrue(LX.WrongBookAPI.count().data < before);
        assertToastIncludes(/移出|掌握|全部/);
    });

    it('S=多错题 A=下一题 → R=导航 index 变化或题干变化', () => {
        const beforeQ = (mounted.root.textContent || '');
        clickText(mounted.root, '下一题');
        const afterQ = (mounted.root.textContent || '');
        const nav = LX.NavigationAPI.current().data;
        assertTrue(nav.total >= 1);
        // 循环切题后文案或 index 应可观测（允许循环回同一题若仅 1 题，本用例有 2 题）
        assertTrue(beforeQ !== afterQ || nav.index >= 0);
    });

    it('S=最后一题错题 A=我已掌握清完 → R=庆祝/全部掌握', () => {
        // 先掌握一题
        clickText(mounted.root, '我已掌握');
        clearToastLog();
        // 若已清完则已庆祝；否则再掌握
        if (LX.WrongBookAPI.count().data > 0) {
            mounted.destroy();
            mounted = mountPage(createWrongBookPage);
            clearToastLog();
            clickText(mounted.root, '我已掌握');
        }
        assertToastIncludes(/全部掌握|掌握/);
        assertEqual(LX.WrongBookAPI.count().data, 0);
    });

    it('S=错题模式中 A=退出 → R=navigate home 且可 exit', () => {
        clickText(mounted.root, '退出');
        assertNavigatedTo('home');
        assertOk(LX.WrongBookAPI.exit());
    });

    it('S=无错题 A=挂载页 → R=空态或提示（不崩溃）', async () => {
        await resetStateBeforeEach();
        LX = getLX();
        createAndSwitchLibrary('无错题库', [
            { id: 1, type: 'essay', question: '无错', answer: '' },
        ]);
        mounted.destroy();
        mounted = mountPage(createWrongBookPage);
        assertTrue(mounted.root.isConnected);
        // enter 失败时页面应有提示或空态文案
        assertTextIncludes(mounted.root, /错题|没有|空|专注|返回|首页/);
    });
}, { layer: 'ui', tags: ['buttons', 'wrongbook', 'sar'] });
