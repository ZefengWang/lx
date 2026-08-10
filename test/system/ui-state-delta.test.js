/**
 * 系统测：UI 状态差分（首批 P0）
 * 协议：docs/testing/UI-CONTROLS.inventory.json → systemTestProtocol / systemCases
 *
 * @module test/system/ui-state-delta.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    mountShell,
    clickText,
    clearToastLog,
    clickLabel,
    installConfirmSpy,
} from '../ui/dom-harness.js';
import { openDrawer } from '../../src/render/drawer.js';
import { collectUiState, assertStateDelta } from './ui-state-collector.js';

describe('系统：UI 状态差分（P0）', () => {
    /** @type {{ root: HTMLElement, destroy: () => void, refresh: () => void } | null} */
    let shell = null;

    function before() {
        resetStateBeforeEach();
        createAndSwitchLibrary('差分库', [
            { type: 'single', category: 'A', question: 'Q1', options: ['a', 'b'], answer: 'A' },
            { type: 'single', category: 'A', question: 'Q2', options: ['a', 'b'], answer: 'A' },
            { type: 'single', category: 'A', question: 'Q3', options: ['a', 'b'], answer: 'A' },
            { type: 'single', category: 'A', question: 'Q4', options: ['a', 'b'], answer: 'A' },
            { type: 'single', category: 'A', question: 'Q5', options: ['a', 'b'], answer: 'A' },
        ]);
        if (shell) shell.destroy();
        shell = mountShell({ routeName: 'study' });
    }

    function after() {
        if (shell) {
            shell.destroy();
            shell = null;
        }
    }

    it('SYS-SHELL-RESET-PROGRESS-TOPBAR：重置后 progressText=0/N', () => {
        before();
        try {
            const LX = getLX();
            const q1 = LX.QuestionAPI.get(1).data;
            const q2 = LX.QuestionAPI.get(2).data;
            const q3 = LX.QuestionAPI.get(3).data;
            LX.ProgressAPI.setStatus(q1, 'mastered');
            LX.ProgressAPI.setStatus(q2, 'mastered');
            LX.ProgressAPI.setStatus(q3, 'review');
            const beforeState = collectUiState(shell.root);
            assertTrue((beforeState.chrome.progressText || '').includes('2/'), beforeState.chrome.progressText);

            openDrawer('sys');
            clearToastLog();
            assertEqual(collectUiState(shell.root).meta.drawerOpen, true);

            clickText(shell.root, '重置学习进度');
            const afterState = collectUiState(shell.root);
            assertStateDelta(beforeState, afterState, {
                domain: { progress: { mastered: 0, review: 0 } },
                chrome: { wrongBadge: 0 },
                meta: { drawerOpen: false },
            });
            assertTrue(
                (afterState.chrome.progressText || '').includes('0/5'),
                `期望 0/5，实际=${afterState.chrome.progressText}`,
            );
            assertTrue((afterState.meta.toastLast || '').includes('进度已重置'));
        } finally {
            after();
        }
    });

    it('SYS-SHELL-RESET-PROGRESS-CANCEL：取消后 progress 不变', () => {
        before();
        try {
            const LX = getLX();
            const q1 = LX.QuestionAPI.get(1).data;
            LX.ProgressAPI.setStatus(q1, 'mastered');
            const beforeState = collectUiState(shell.root);
            const off = installConfirmSpy(false);
            openDrawer('sys');
            clickText(shell.root, '重置学习进度');
            const afterState = collectUiState(shell.root);
            assertStateDelta(beforeState, afterState, {}, ['domain.progress', 'chrome.progressText']);
            assertEqual(LX.ProgressAPI.getStatus(q1).data, 'mastered');
            off();
        } finally {
            after();
        }
    });

    it('SYS-STUDY-STATUS-CYCLE-TOPBAR：底栏掌握→错题→清除同步顶栏', () => {
        before();
        try {
            let beforeState = collectUiState(shell.root);
            clickLabel(shell.root, '标记为已掌握');
            let afterState = collectUiState(shell.root);
            assertStateDelta(beforeState, afterState, {
                domain: { progress: { mastered: 1 } },
            });
            assertTrue((afterState.chrome.progressText || '').includes('1/'));

            clickLabel(shell.root, '加入错题');
            afterState = collectUiState(shell.root);
            assertEqual(afterState.domain.progress.review, 1);
            assertEqual(afterState.chrome.wrongBadge, 1);

            clickLabel(shell.root, '清除标记');
            afterState = collectUiState(shell.root);
            assertEqual(afterState.domain.progress.review, 0);
            assertEqual(afterState.chrome.wrongBadge, 0);
        } finally {
            after();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'delta'] });
