import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertOk, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createAddQuestionPage } from '../../../src/render/pages/add-question.js';
import {
    mountPage, clickText, type, assertTextIncludes, preserveHash,
    assertNavigatedTo, clearNavigateLog, getNavigateLog,
    installToastSpy, assertToastIncludes, clearToastLog,
    installConfirmSpy, assertConfirmAsked,
} from '../dom-harness.js';

/**
 * SAR 最低矩阵已覆盖：取消 confirm 真/假；空题干/各题型校验失败；保存成功；返回浏览。
 */
describe('UI 按钮：新增题目 add-question（SAR）', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        createAndSwitchLibrary('新增SAR库', [
            { id: 1, type: 'essay', question: '占位', answer: '', category: '默认' },
        ]);
        mounted = mountPage(createAddQuestionPage);
        clearToastLog();
        clearNavigateLog();
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    it('S=空表单 A=取消+confirm 同意 → R=navigate browse', () => {
        clickText(mounted.root, '取消');
        assertConfirmAsked('放弃');
        assertNavigatedTo('browse');
    });

    it('S=空表单 A=取消+confirm 拒绝 → R=不导航且仍在表单', () => {
        const off = installConfirmSpy(false);
        clearNavigateLog();
        clickText(mounted.root, '取消');
        assertConfirmAsked('放弃');
        assertEqual(getNavigateLog().length, 0);
        assertTextIncludes(mounted.root, /题干|保存/);
        off();
    });

    it('S=空题干 A=保存 → R=toast 警告且题数不变', () => {
        const before = LX.QuestionAPI.list().data.total;
        clickText(mounted.root, /保存/);
        assertToastIncludes('题干不能为空');
        assertEqual(LX.QuestionAPI.list().data.total, before);
    });

    it('S=单选填齐 A=保存 → R=题数+1 且可搜索到', () => {
        try { clickText(mounted.root, '单选'); } catch (_) { /* 默认可能已是 */ }
        const qInput = mounted.root.querySelector('textarea')
            || mounted.root.querySelector('input[type="text"]');
        assertTrue(!!qInput, '应有题干输入');
        type(qInput, '自动化新增的题干XYZ');
        const optInputs = mounted.root.querySelectorAll('.lx-addq__opt-input, input[placeholder*="选项"]');
        if (optInputs.length >= 2) {
            type(optInputs[0], '选项一');
            type(optInputs[1], '选项二');
        }
        const answerBtns = [...mounted.root.querySelectorAll('button, label, input')];
        const aBtn = answerBtns.find((el) => {
            const t = (el.textContent || '').trim();
            return t === 'A' || t.includes('选项一') || (el.value === 'A');
        });
        if (aBtn) aBtn.click();
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        const after = LX.QuestionAPI.list().data.total;
        assertEqual(after, before + 1);
        const hit = LX.QuestionAPI.search('XYZ');
        assertOk(hit);
        assertTrue(hit.data.total >= 1);
        assertToastIncludes('已添加');
    });

    it('S=判断题型 A=未选对错就保存 → R=toast 且题数不变', () => {
        clickText(mounted.root, '判断');
        const qInput = mounted.root.querySelector('textarea')
            || mounted.root.querySelector('input[type="text"]');
        type(qInput, '判断题干ABC');
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before);
        assertToastIncludes(/对或错|不能为空|请/);
    });

    it('S=判断题填齐 A=保存 → R=题数+1', () => {
        clickText(mounted.root, '判断题');
        const qInput = mounted.root.querySelector('textarea');
        type(qInput, '地球是圆的吗JUDGE');
        clickText(mounted.root, /✓ 对|对/);
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before + 1);
        assertToastIncludes('已添加');
    });

    it('S=填空无答案 A=保存 → R=toast 请输入填空答案', () => {
        clickText(mounted.root, '填空题');
        const qInput = mounted.root.querySelector('textarea');
        type(qInput, '首都是___');
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before);
        assertToastIncludes('填空答案');
    });

    it('S=填空填齐 A=保存 → R=题数+1', () => {
        clickText(mounted.root, '填空题');
        const qInput = mounted.root.querySelector('textarea');
        type(qInput, '中国首都是___FILL');
        const ans = [...mounted.root.querySelectorAll('input[type="text"]')]
            .find((el) => (el.placeholder || '').includes('填空') || (el.placeholder || '').includes('答案'));
        assertTrue(!!ans, '应有填空答案输入');
        type(ans, '北京');
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before + 1);
        assertToastIncludes('已添加');
    });

    it('S=简答无参考答案 A=保存 → R=toast 请输入参考答案', () => {
        clickText(mounted.root, '简答题');
        const areas = mounted.root.querySelectorAll('textarea');
        type(areas[0], '简答题干ESSAY');
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before);
        assertToastIncludes('参考答案');
    });

    it('S=简答填齐 A=保存 → R=题数+1', () => {
        clickText(mounted.root, '简答题');
        const areas = [...mounted.root.querySelectorAll('textarea')];
        type(areas[0], '简答题干ESSAYOK');
        // 参考答案一般是第二块 textarea
        const ref = areas.find((el, i) => i > 0) || areas[areas.length - 1];
        type(ref, '这是参考答案全文');
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before + 1);
        assertToastIncludes('已添加');
    });

    it('S=多选未选答案 A=保存 → R=toast 请选择正确答案', () => {
        clickText(mounted.root, '多选题');
        const qInput = mounted.root.querySelector('textarea');
        type(qInput, '多选题干MULTI');
        const optInputs = mounted.root.querySelectorAll('.lx-addq__opt-input');
        if (optInputs.length >= 2) {
            type(optInputs[0], '甲');
            type(optInputs[1], '乙');
        }
        const before = LX.QuestionAPI.list().data.total;
        clearToastLog();
        clickText(mounted.root, /保存/);
        assertEqual(LX.QuestionAPI.list().data.total, before);
        assertToastIncludes('正确答案');
    });

    it('S=返回浏览 A=点击 → R=navigate browse（不经放弃 confirm）', () => {
        clearNavigateLog();
        clickText(mounted.root, '返回浏览');
        assertNavigatedTo('browse');
    });
}, { layer: 'ui', tags: ['buttons', 'add-question', 'sar'] });
