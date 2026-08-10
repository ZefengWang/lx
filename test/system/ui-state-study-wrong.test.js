/**
 * 系统测：刷题卡作答 / 错题本 — 状态差分（含顶栏）
 * @module test/system/ui-state-study-wrong.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    clickText, clickLabel, clearToastLog, clearNavigateLog,
    assertNavigatedTo, assertToastIncludes, getNavigateLog,
} from '../ui/dom-harness.js';
import { createStudyPage } from '../../src/render/pages/study.js';
import { createWrongBookPage } from '../../src/render/pages/wrongbook.js';
import { collectUiState, assertStateDelta } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';

function clickOption(root, index) {
    const opts = root.querySelectorAll('.lx-option');
    assertTrue(opts.length > index, `选项不足 index=${index} len=${opts.length}`);
    opts[index].click();
}

function clickBadge(root) {
    const b = root.querySelector('.lx-status-badge');
    assertTrue(!!b, '应有状态徽章');
    b.click();
}

/** 精确点「✓ 我已掌握」按钮，避免 clickText 误点其它含「掌握」节点 */
function clickMasteredButton(root) {
    const btn = [...root.querySelectorAll('button')]
        .find((b) => (b.textContent || '').trim().includes('我已掌握'));
    assertTrue(!!btn, '应有「我已掌握」按钮');
    btn.click();
}

describe('系统：UI 状态差分 · 刷题/错题本', () => {
    /** @type {ReturnType<typeof mountShellWithPage> | null} */
    let ctx = null;

    function tear() {
        if (ctx) {
            ctx.destroy();
            ctx = null;
        }
    }

    it('SYS-STUDY-ANSWER-CORRECT：单选正确 → mastered + progressText', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('刷题差分库', [
            { id: 1, type: 'single', question: '答对题', options: ['正确', '错误'], answer: 'A', category: 'T' },
            { id: 2, type: 'single', question: '第二题', options: ['正确', '错误'], answer: 'A', category: 'T' },
        ]);
        ctx = mountShellWithPage(createStudyPage, { routeName: 'study' });
        clearToastLog();
        try {
            const before = collectUiState(ctx.root);
            assertEqual(before.domain.progress.mastered, 0);
            clickOption(ctx.root, 0);
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.progress.mastered, 1);
            assertTrue((after.chrome.progressText || '').includes('1/'));
            assertEqual(after.domain.progress.currentStatus, 'mastered');
            assertStateDelta(before, after, {
                domain: { progress: { mastered: 1, currentStatus: 'mastered' } },
            });
        } finally {
            tear();
        }
    });

    it('SYS-STUDY-ANSWER-WRONG：单选错误 → review + wrongBadge', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('刷题错差分库', [
            { id: 1, type: 'single', question: '答错题', options: ['正确', '错误'], answer: 'A', category: 'T' },
        ]);
        ctx = mountShellWithPage(createStudyPage, { routeName: 'study' });
        clearToastLog();
        try {
            const before = collectUiState(ctx.root);
            clickOption(ctx.root, 1);
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.progress.review, 1);
            assertEqual(after.chrome.wrongBadge, 1);
            assertEqual(after.domain.progress.currentStatus, 'review');
            assertStateDelta(before, after, {
                domain: { progress: { review: 1 } },
                chrome: { wrongBadge: 1 },
            });
        } finally {
            tear();
        }
    });

    it('SYS-STUDY-NAV-PREV-NEXT：底栏翻题 index 变化且 progress 不变', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('翻题差分库', [
            { id: 1, type: 'essay', question: 'N1', answer: '', category: 'T' },
            { id: 2, type: 'essay', question: 'N2', answer: '', category: 'T' },
            { id: 3, type: 'essay', question: 'N3', answer: '', category: 'T' },
        ]);
        ctx = mountShellWithPage(createStudyPage, { routeName: 'study' });
        try {
            const LX = getLX();
            const before = collectUiState(ctx.root);
            const i0 = LX.NavigationAPI.current().data.index;
            clickLabel(ctx.root, '下一题');
            const i1 = LX.NavigationAPI.current().data.index;
            assertTrue(i1 !== i0);
            const mid = collectUiState(ctx.root);
            assertStateDelta(before, mid, {}, ['domain.progress']);
            clickLabel(ctx.root, '上一题');
            assertEqual(LX.NavigationAPI.current().data.index, i0);
        } finally {
            tear();
        }
    });

    it('SYS-STUDY-STATUS-BADGE：徽章循环 none→mastered→review→none', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('徽章差分库', [
            { id: 1, type: 'essay', question: '徽章题', answer: '', category: 'T' },
        ]);
        ctx = mountShellWithPage(createStudyPage, { routeName: 'study' });
        clearToastLog();
        try {
            clickBadge(ctx.root);
            assertEqual(collectUiState(ctx.root).domain.progress.currentStatus, 'mastered');
            assertTrue((collectUiState(ctx.root).chrome.progressText || '').includes('1/'));
            clickBadge(ctx.root);
            assertEqual(collectUiState(ctx.root).domain.progress.currentStatus, 'review');
            assertEqual(collectUiState(ctx.root).chrome.wrongBadge, 1);
            clickBadge(ctx.root);
            assertEqual(collectUiState(ctx.root).domain.progress.currentStatus, 'none');
            assertEqual(collectUiState(ctx.root).chrome.wrongBadge, 0);
        } finally {
            tear();
        }
    });

    it('SYS-WRONGBOOK-CLEAR-CELEBRATE：清空错题 → 庆祝 + wrongBadge=0', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('错题本差分库', [
            { id: 1, type: 'single', question: '错1', options: ['对', '错'], answer: 'A', category: 'W' },
            { id: 2, type: 'single', question: '错2', options: ['对', '错'], answer: 'A', category: 'W' },
        ]);
        const LX = getLX();
        LX.QuestionAPI.answer(1, 'B');
        LX.QuestionAPI.answer(2, 'B');
        ctx = mountShellWithPage(createWrongBookPage, { routeName: 'wrong', showBottombar: false });
        clearToastLog();
        try {
            let s = collectUiState(ctx.root);
            assertEqual(s.domain.wrongbook.active, true);
            assertTrue(s.domain.wrongbook.count >= 1);

            clickMasteredButton(ctx.root);
            s = collectUiState(ctx.root);
            if (!s.page.celebrateVisible) {
                clickMasteredButton(ctx.root);
                s = collectUiState(ctx.root);
            }
            assertEqual(s.domain.wrongbook.count, 0);
            assertEqual(s.chrome.wrongBadge, 0);
            assertEqual(s.page.celebrateVisible, true);
        } finally {
            tear();
        }
    });

    it('SYS-WRONGBOOK-EXIT：退出 → wrongbook.active=false + navigate home', () => {
        resetStateBeforeEach();
        // 库名勿含「退出」，否则 clickText('退出') 会误点顶栏题库名 → settings
        createAndSwitchLibrary('错题本导航库', [
            { id: 1, type: 'single', question: '错退', options: ['对', '错'], answer: 'A', category: 'W' },
        ]);
        getLX().QuestionAPI.answer(1, 'B');
        ctx = mountShellWithPage(createWrongBookPage, { routeName: 'wrong', showBottombar: false });
        clearNavigateLog();
        try {
            assertEqual(collectUiState(ctx.root).domain.wrongbook.active, true);
            const exitBtn = [...ctx.root.querySelectorAll('button')]
                .find((b) => (b.textContent || '').trim() === '退出');
            assertTrue(!!exitBtn, '应有精确文案「退出」按钮');
            exitBtn.click();
            assertNavigatedTo('home');
            assertEqual(collectUiState(ctx.root).domain.wrongbook.active, false);
        } finally {
            tear();
        }
    });

    it('SYS-TOPBAR-WRONG-EMPTY：无错题点角标 → toast 不跳转', () => {
        resetStateBeforeEach();
        createAndSwitchLibrary('无错题库', [
            { id: 1, type: 'essay', question: '无错', answer: '', category: 'T' },
        ]);
        ctx = mountShellWithPage(createStudyPage, { routeName: 'study' });
        clearToastLog();
        clearNavigateLog();
        try {
            assertEqual(collectUiState(ctx.root).chrome.wrongBadge, 0);
            clickLabel(ctx.root, '错题本（0）');
            assertToastIncludes('没有错题');
            assertEqual(getNavigateLog().some((e) => e.name === 'wrong'), false);
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'study', 'wrong', 'delta'] });
