/**
 * 系统测：新增题目 — 状态差分
 * @module test/system/ui-state-addq.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach, createAndSwitchLibrary, getLX } from '../helpers.js';
import {
    clickText, clickLabel, type, clearToastLog, clearNavigateLog,
    assertNavigatedTo, assertToastIncludes, installConfirmSpy, getNavigateLog,
} from '../ui/dom-harness.js';
import { createAddQuestionPage } from '../../src/render/pages/add-question.js';
import { collectUiState, assertStateDelta } from './ui-state-collector.js';
import { mountShellWithPage } from './ui-state-harness.js';

describe('系统：UI 状态差分 · 新增题目', () => {
    /** @type {ReturnType<typeof mountShellWithPage> | null} */
    let ctx = null;

    function seed() {
        resetStateBeforeEach();
        createAndSwitchLibrary('新增差分库', [
            { id: 1, type: 'essay', question: '占位', answer: '' },
        ]);
        if (ctx) ctx.destroy();
        ctx = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
        clearToastLog();
        clearNavigateLog();
    }

    function tear() {
        if (ctx) {
            ctx.destroy();
            ctx = null;
        }
    }

    it('SYS-ADDQ-SAVE-SINGLE：单选填齐保存 → questionCount+1 + toast', () => {
        seed();
        try {
            const before = collectUiState(ctx.root);
            clickText(ctx.root, '单选');
            const stem = ctx.root.querySelector('textarea.lx-textarea')
                || [...ctx.root.querySelectorAll('textarea')].find((t) => (t.placeholder || '').includes('题干'));
            assertTrue(!!stem, '应有题干框');
            type(stem, '新增单选题干ALPHA');
            const optInputs = ctx.root.querySelectorAll('.lx-addq__opt-input');
            assertTrue(optInputs.length >= 2);
            type(optInputs[0], '选项甲');
            type(optInputs[1], '选项乙');
            const checks = ctx.root.querySelectorAll('.lx-addq__opt-check');
            assertTrue(checks.length >= 1);
            checks[0].click();
            clearToastLog();
            clickText(ctx.root, '保存题目');
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.questionCount, before.domain.questionCount + 1);
            assertToastIncludes('已添加');
            // 顶栏 total 若订阅 QUESTION_* 可能更新；至少 domain 变了
            assertStateDelta(before, after, {
                domain: { questionCount: before.domain.questionCount + 1 },
            });
        } finally {
            tear();
        }
    });

    it('SYS-ADDQ-SAVE-EMPTY：空题干保存失败 → count 不变', () => {
        seed();
        try {
            const before = collectUiState(ctx.root);
            clearToastLog();
            clickText(ctx.root, '保存题目');
            const after = collectUiState(ctx.root);
            assertEqual(after.domain.questionCount, before.domain.questionCount);
            assertToastIncludes(/题干|填写|不能为空/);
        } finally {
            tear();
        }
    });

    it('SYS-ADDQ-CANCEL-ABORT：取消 confirm 拒绝 → 不 navigate', () => {
        seed();
        try {
            const off = installConfirmSpy(false);
            clearNavigateLog();
            clickText(ctx.root, '取消');
            assertEqual(getNavigateLog().some((e) => e.name === 'browse'), false);
            off();
        } finally {
            tear();
        }
    });

    it('SYS-ADDQ-BACK：返回浏览 → navigate browse', () => {
        seed();
        try {
            clearNavigateLog();
            clickText(ctx.root, '返回浏览');
            assertNavigatedTo('browse');
        } finally {
            tear();
        }
    });
}, { layer: 'system', tags: ['ui-state', 'addq', 'delta'] });
