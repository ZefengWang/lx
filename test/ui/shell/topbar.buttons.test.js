import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual } from '../../assert.js';
import {
    createMountPoint, destroyMountPoint, resetStateBeforeEach,
    createAndSwitchLibrary, getLX,
} from '../../helpers.js';
import { renderTopbar } from '../../../src/render/topbar.js';
import {
    clickLabel, installNavigateSpy, assertNavigatedTo, clearNavigateLog,
    installToastSpy, assertToastIncludes, clearToastLog,
    mountShell, assertDrawerOpen,
} from '../dom-harness.js';

/**
 * SAR 最低矩阵已覆盖：study/非 study 控件形态；无错题 toast；有错题 navigate；进度/题库/菜单。
 */
describe('UI 按钮：顶栏 topbar', () => {
    let root;
    let flags;
    let uninstallNav;
    let uninstallToast;

    beforeEach(async () => {
        await resetStateBeforeEach();
        root = createMountPoint();
        flags = { menu: 0, back: 0, lib: 0, wrong: 0, progress: 0 };
        uninstallNav = installNavigateSpy();
        uninstallToast = installToastSpy();
    });

    afterEach(() => {
        destroyMountPoint(root);
        root = null;
        if (uninstallNav) uninstallNav();
        if (uninstallToast) uninstallToast();
    });

    it('study 页：菜单 / 切库 / 错题 / 进度均可点', () => {
        root.appendChild(renderTopbar({
            routeName: 'study',
            libraryName: '测库',
            wrongCount: 2,
            masteredCount: 1,
            totalCount: 5,
            percent: 20,
            onMenu: () => { flags.menu++; },
            onBack: () => { flags.back++; },
            onLibraryClick: () => { flags.lib++; },
            onWrongClick: () => { flags.wrong++; },
            onProgressClick: () => { flags.progress++; },
        }));
        clickLabel(root, '打开菜单');
        clickLabel(root, '切换题库');
        clickLabel(root, '错题本');
        clickLabel(root, '进度');
        assertEqual(flags.menu, 1);
        assertEqual(flags.lib, 1);
        assertEqual(flags.wrong, 1);
        assertEqual(flags.progress, 1);
        assertEqual(flags.back, 0);
    });

    it('非 study 页：显示返回刷题', () => {
        root.appendChild(renderTopbar({
            routeName: 'catalog',
            libraryName: '测库',
            wrongCount: 0,
            masteredCount: 0,
            totalCount: 1,
            onMenu: () => { flags.menu++; },
            onBack: () => { flags.back++; },
            onLibraryClick: () => {},
            onWrongClick: () => {},
            onProgressClick: () => {},
        }));
        clickLabel(root, '返回刷题');
        assertEqual(flags.back, 1);
        assertEqual(flags.menu, 0);
    });
}, { layer: 'ui', tags: ['buttons', 'shell', 'topbar'] });

describe('UI 壳层接线：topbar → navigate/toast/drawer', () => {
    let shell;

    beforeEach(async () => {
        await resetStateBeforeEach();
        createAndSwitchLibrary('顶栏接线库', [
            { id: 1, type: 'essay', question: 't1', answer: '', category: 'A' },
        ]);
        shell = mountShell({ routeName: 'study' });
        clearNavigateLog();
        clearToastLog();
    });

    afterEach(() => {
        if (shell) shell.destroy();
        shell = null;
    });

    it('无错题时点错题角标 → toast 提示', () => {
        clickLabel(shell.root, '错题本');
        assertToastIncludes('当前没有错题');
    });

    it('有错题时点错题角标 → navigate wrong', () => {
        const LX = getLX();
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'review');
        shell.refresh();
        clearNavigateLog();
        clickLabel(shell.root, '错题本');
        assertNavigatedTo('wrong');
    });

    it('点进度 → stats；点题库名 → settings；菜单开抽屉', () => {
        clickLabel(shell.root, '进度');
        assertNavigatedTo('stats');
        clearNavigateLog();
        clickLabel(shell.root, '切换题库');
        assertNavigatedTo('settings');
        clearNavigateLog();
        clickLabel(shell.root, '打开菜单');
        assertDrawerOpen(true);
    });
}, { layer: 'ui', tags: ['buttons', 'shell', 'topbar'] });
