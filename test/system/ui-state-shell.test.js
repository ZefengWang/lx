/**
 * 系统测：壳层导航 / 建库 — 状态差分
 * @module test/system/ui-state-shell.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    mountShell, clickText, clickLabel, clearToastLog, clearNavigateLog,
    assertNavigatedTo, assertToastIncludes, installPromptSpy,
} from '../ui/dom-harness.js';
import { openDrawer } from '../../src/render/drawer.js';
import { createHomePage } from '../../src/render/pages/home.js';
import { createHelpPage } from '../../src/render/pages/help.js';
import { createStudyPage } from '../../src/render/pages/study.js';
import { collectUiState } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';

describe('系统：UI 状态差分 · 壳层/首页/帮助', () => {
    /** @type {{ root: HTMLElement, destroy: () => void, refresh?: () => void } | null} */
    let shell = null;

    function tear() {
        if (shell) {
            shell.destroy();
            shell = null;
        }
    }

    it('SYS-SHELL-MENU-TOGGLE：菜单开关抽屉', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('壳层库', [
            { id: 1, type: 'essay', question: 'q', answer: '' },
        ]);
        shell = mountShell({ routeName: 'study' });
        try {
            assertEqual(collectUiState(shell.root).meta.drawerOpen, false);
            clickLabel(shell.root, '打开菜单');
            assertEqual(collectUiState(shell.root).meta.drawerOpen, true);
            clickLabel(shell.root, '关闭菜单');
            assertEqual(collectUiState(shell.root).meta.drawerOpen, false);
        } finally {
            tear();
        }
    });

    it('SYS-SHELL-PROGRESS-NAV：点进度 → navigate stats', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('进度跳转库', [
            { id: 1, type: 'essay', question: 'q', answer: '' },
        ]);
        shell = mountShell({ routeName: 'study' });
        clearNavigateLog();
        try {
            clickLabel(shell.root, /^进度：/);
            assertNavigatedTo('stats');
        } finally {
            tear();
        }
    });

    it('SYS-SHELL-LIB-TITLE-NAV：点题库名 → settings', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('切库跳转', [
            { id: 1, type: 'essay', question: 'q', answer: '' },
        ]);
        shell = mountShell({ routeName: 'study' });
        clearNavigateLog();
        try {
            clickLabel(shell.root, '切换题库');
            assertNavigatedTo('settings');
        } finally {
            tear();
        }
    });

    it('SYS-SHELL-CREATE-LIBRARY：新建空题库 → libCount+1 + add-question', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('原库', [
            { id: 1, type: 'essay', question: 'q', answer: '' },
        ]);
        shell = mountShell({ routeName: 'study' });
        const off = installPromptSpy('差分新建库');
        clearNavigateLog();
        clearToastLog();
        try {
            const before = collectUiState(shell.root);
            openDrawer('sys');
            clickText(shell.root, '新建空题库');
            assertNavigatedTo('add-question');
            const after = collectUiState(shell.root);
            assertEqual(after.domain.libCount, before.domain.libCount + 1);
            assertToastIncludes('已创建');
        } finally {
            off();
            tear();
        }
    });

    it('SYS-SHELL-CREATE-LIBRARY-CANCEL：prompt 取消不建库', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('原库2', [
            { id: 1, type: 'essay', question: 'q', answer: '' },
        ]);
        shell = mountShell({ routeName: 'study' });
        const off = installPromptSpy(null);
        clearNavigateLog();
        try {
            const before = collectUiState(shell.root);
            openDrawer('sys');
            clickText(shell.root, '新建空题库');
            const after = collectUiState(shell.root);
            assertEqual(after.domain.libCount, before.domain.libCount);
        } finally {
            off();
            tear();
        }
    });

    it('SYS-HOME-START-STUDY：开始学习 → navigate study', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('首页库', [
            { id: 1, type: 'essay', question: 'h', answer: '' },
        ]);
        shell = mountShellWithPage(createHomePage, { routeName: 'home', showBottombar: false });
        clearNavigateLog();
        try {
            clickText(shell.root, '开始学习');
            assertNavigatedTo('study');
        } finally {
            tear();
        }
    });

    it('SYS-HELP-GO-STUDY：帮助页去刷题 → study', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('帮助库', [
            { id: 1, type: 'essay', question: 'h', answer: '' },
        ]);
        shell = mountShellWithPage(createHelpPage, { routeName: 'help', showBottombar: false });
        clearNavigateLog();
        try {
            clickText(shell.root, '去刷题');
            assertNavigatedTo('study');
        } finally {
            tear();
        }
    });

    it('SYS-BOTTOMBAR-BROWSE：底栏浏览 → navigate browse', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('底栏浏览库', [
            { id: 1, type: 'essay', question: 'b', answer: '' },
        ]);
        shell = mountShellWithPage(createStudyPage, { routeName: 'study' });
        clearNavigateLog();
        try {
            clickLabel(shell.root, '浏览');
            assertNavigatedTo('browse');
        } finally {
            tear();
        }
    });

    it('SYS-SHELL-SWITCH-LIB：抽屉切库 → currentLib 变 + progressText 刷新', () => {
        resetStateBeforeEach();
        const a = createAndSwitchLibrary('库A差分', [
            { id: 1, type: 'essay', question: 'A1', answer: '' },
        ]);
        const LX = getLX();
        LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
        const r = LX.LibraryAPI.create('库B差分', [
            { id: 1, type: 'essay', question: 'B1', answer: '' },
            { id: 2, type: 'essay', question: 'B2', answer: '' },
        ], { skipDuplicateCheck: true });
        assertTrue(r.ok);
        LX.LibraryAPI.switch(a.libId);
        shell = mountShell({ routeName: 'study' });
        try {
            const before = collectUiState(shell.root);
            assertTrue((before.chrome.progressText || '').includes('1/1') || (before.chrome.progressText || '').includes('1/'));
            openDrawer('switch');
            clickText(shell.root, '库B差分');
            assertNavigatedTo('study');
            const after = collectUiState(shell.root);
            assertEqual(after.domain.currentLibId, r.data.id);
            assertTrue((after.chrome.progressText || '').includes('/2') || after.domain.questionCount === 2);
            assertEqual(after.domain.progress.mastered, 0);
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'shell', 'delta'] });
