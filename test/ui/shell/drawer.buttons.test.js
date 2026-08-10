import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue, assertOk } from '../../assert.js';
import {
    resetStateBeforeEach, createAndSwitchLibrary, getLX,
} from '../../helpers.js';
import {
    mountShell,     clickText, clickLabel, clearNavigateLog, assertNavigatedTo,
    assertDrawerOpen, assertToastIncludes, clearToastLog,
    assertConfirmAsked, installConfirmSpy, getConfirmLog,
} from '../dom-harness.js';
import { openDrawer } from '../../../src/render/drawer.js';

/**
 * SAR 最低矩阵已覆盖：切库/建库/帮助/统计/重置；confirm 取消不重置；进度文案同步。
 */
describe('UI 按钮：抽屉 drawer', () => {
    let shell;
    let libA;
    let libB;

    beforeEach(async () => {
        await resetStateBeforeEach();
        libA = createAndSwitchLibrary('抽屉库A', [
            { id: 1, type: 'essay', question: 'A1', answer: '', category: '甲' },
        ]);
        const LX = getLX();
        const r = LX.LibraryAPI.create('抽屉库B', [
            { id: 1, type: 'essay', question: 'B1', answer: '', category: '乙' },
        ]);
        assertOk(r);
        libB = r.data.id;
        LX.LibraryAPI.switch(libA.libId);
        shell = mountShell({ routeName: 'study' });
        openDrawer('test');
        clearNavigateLog();
        clearToastLog();
    });

    afterEach(() => {
        if (shell) shell.destroy();
        shell = null;
    });

    it('关闭菜单按钮可关抽屉', () => {
        assertDrawerOpen(true);
        clickLabel(shell.root, '关闭菜单');
        assertDrawerOpen(false);
    });

    it('切库 → switch + navigate study', () => {
        clickText(shell.root, '抽屉库B');
        const LX = getLX();
        assertEqual(LX.LibraryAPI.current().data, libB);
        assertNavigatedTo('study');
        assertDrawerOpen(false);
    });

    it('上传新题库 → settings', () => {
        openDrawer('reopen');
        clearNavigateLog();
        clickText(shell.root, '上传新题库');
        assertNavigatedTo('settings');
    });

    it('新建空题库 → prompt + create + add-question', () => {
        openDrawer('reopen');
        clearNavigateLog();
        clickText(shell.root, '新建空题库');
        assertNavigatedTo('add-question');
        assertToastIncludes('已创建空题库');
        const LX = getLX();
        const cur = LX.LibraryAPI.get(LX.LibraryAPI.current().data).data;
        assertTrue(cur.name.includes('壳层测试题库') || cur.name.length > 0);
    });

    it('使用帮助 → help；关于 / 导出入口 → settings', () => {
        openDrawer('reopen');
        clearNavigateLog();
        clickText(shell.root, '使用帮助');
        assertNavigatedTo('help');

        openDrawer('reopen');
        clearNavigateLog();
        clickText(shell.root, '关于');
        assertNavigatedTo('settings');

        openDrawer('reopen');
        clearNavigateLog();
        clickText(shell.root, '导出当前题库');
        assertNavigatedTo('settings');
    });

    it('查看进度统计 → 改 hash 到 stats（抽屉内联）', () => {
        openDrawer('reopen');
        const prev = location.hash;
        clickText(shell.root, '查看进度统计');
        assertTrue((location.hash || '').includes('stats'));
        location.hash = prev;
    });

    it('重置学习进度 → confirm + toast', () => {
        const LX = getLX();
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'mastered');
        openDrawer('reopen');
        clearToastLog();
        clickText(shell.root, '重置学习进度');
        assertConfirmAsked('重置');
        assertToastIncludes('进度已重置');
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'none');
    });

    it('S=有掌握 A=抽屉重置进度 → R=lx-progress-text 同步为 0/N', () => {
        const LX = getLX();
        const total = LX.StatsAPI.summary().data.total;
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'mastered');
        shell.refresh();
        const before = shell.root.querySelector('.lx-progress-text')?.textContent || '';
        assertTrue(before.includes('1/'), `重置前进度应含 1/，实际=${before}`);
        openDrawer('reopen');
        clickText(shell.root, '重置学习进度');
        const after = shell.root.querySelector('.lx-progress-text')?.textContent || '';
        assertTrue(after.includes(`0/${total}`), `重置后顶栏应为 0/${total}，实际=${after}`);
        assertEqual(LX.StatsAPI.summary().data.mastered, 0);
    });

    it('重置时 confirm 取消则不重置', () => {
        const LX = getLX();
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'review');
        // 临时覆盖 confirm 为 false（mountShell 已装 true spy，这里重装）
        const off = installConfirmSpy(false);
        openDrawer('reopen');
        clickText(shell.root, '重置学习进度');
        assertEqual(getConfirmLog().length >= 1, true);
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'review');
        off();
    });
}, { layer: 'ui', tags: ['buttons', 'shell', 'drawer'] });
