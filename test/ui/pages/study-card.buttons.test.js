import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createStudyPage } from '../../../src/render/pages/study.js';
import {
    mountPage, clickLabel, type, assertTextIncludes, preserveHash,
    installToastSpy, assertToastIncludes, clearToastLog,
} from '../dom-harness.js';

function clickOption(root, index) {
    const opts = root.querySelectorAll('.lx-option');
    assertTrue(opts.length > index, `应有选项 index=${index}，实际 ${opts.length}`);
    opts[index].click();
}

function clickJudge(root, which /* '对'|'错' */) {
    const btns = [...root.querySelectorAll('.lx-judge__btn')];
    const btn = btns.find((b) => (b.textContent || '').includes(which));
    assertTrue(!!btn, `应有判断按钮「${which}」`);
    btn.click();
}

function clickSubmit(root) {
    const btn = root.querySelector('.lx-submit-btn')
        || root.querySelector('[aria-label="确认答案"]');
    assertTrue(!!btn, '应有确认提交按钮');
    btn.click();
}

function clickButtonIncluding(root, re) {
    const btn = [...root.querySelectorAll('button')].find((b) => re.test(b.textContent || ''));
    assertTrue(!!btn, `应有按钮匹配 ${re}`);
    btn.click();
}

/**
 * SAR 最低矩阵已覆盖：五题型对/错/漏选/无参考简答/看解析/状态徽章循环。
 * S=题型/进度/是否有参考答案  A=点选/确认/看解析  R=Progress/toast/DOM
 */
describe('UI 按钮：刷题页 study + card（SAR）', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    function remountAt(index) {
        if (mounted) mounted.destroy();
        const g = LX.NavigationAPI.goto(index);
        assertTrue(g.ok, `goto(${index}) 应成功：${g.error && g.error.message}`);
        mounted = mountPage(createStudyPage);
        clearToastLog();
    }

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        createAndSwitchLibrary('刷题SAR库', [
            {
                id: 1, type: 'single', question: '单选题干ONE',
                options: ['苹果', '香蕉'], answer: 'A', category: '测',
            },
            {
                id: 2, type: 'multi', question: '多选题干TWO',
                options: ['选项甲', '选项乙', '选项丙'], answer: 'A,B', category: '测',
            },
            {
                id: 3, type: 'judge', question: '判断题干THREE',
                options: [], answer: '对', category: '测',
            },
            {
                id: 4, type: 'fill', question: '填空题干FOUR____',
                options: [], answer: '北京', category: '测',
            },
            {
                id: 5, type: 'essay', question: '简答题干FIVE',
                options: [], answer: '', answerText: '参考答案关键词', category: '测',
            },
            {
                id: 6, type: 'essay', question: '简答无参考SIX',
                options: [], answer: '', answerText: '', category: '测',
            },
        ]);
        remountAt(0);
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    it('S=单选未答 A=点正确选项 → R=mastered + toast 正确', () => {
        assertTextIncludes(mounted.root, '单选题干ONE');
        clickOption(mounted.root, 0); // A 苹果
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data).data, 'mastered');
        assertToastIncludes('正确');
    });

    it('S=单选未答 A=点错误选项 → R=review + toast 正确答案', () => {
        assertTextIncludes(mounted.root, '单选题干ONE');
        clickOption(mounted.root, 1); // B 香蕉
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data).data, 'review');
        assertToastIncludes('正确答案');
    });

    it('S=多选未答 A=勾选全对并确认 → R=mastered', () => {
        remountAt(1);
        assertTextIncludes(mounted.root, '多选题干TWO');
        clickOption(mounted.root, 0);
        clickOption(mounted.root, 1);
        clickSubmit(mounted.root);
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(2).data).data, 'mastered');
        assertToastIncludes('正确');
    });

    it('S=多选未答 A=漏选后确认 → R=review', () => {
        remountAt(1);
        LX.ProgressAPI.setStatus(LX.QuestionAPI.get(2).data, 'none');
        remountAt(1);
        clickOption(mounted.root, 0);
        clickSubmit(mounted.root);
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(2).data).data, 'review');
        assertToastIncludes(/正确|答案/);
    });

    it('S=判断未答 A=点对 → R=mastered', () => {
        remountAt(2);
        assertTextIncludes(mounted.root, '判断题干THREE');
        clickJudge(mounted.root, '对');
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(3).data).data, 'mastered');
    });

    it('S=判断未答 A=点错 → R=review', () => {
        remountAt(2);
        clickJudge(mounted.root, '错');
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(3).data).data, 'review');
    });

    it('S=填空未答 A=填正确并确认 → R=mastered；错误 → review', () => {
        remountAt(3);
        const input = mounted.root.querySelector('.lx-fill__input');
        assertTrue(!!input, '应有填空输入');
        type(input, '北京');
        clickSubmit(mounted.root);
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(4).data).data, 'mastered');

        LX.ProgressAPI.setStatus(LX.QuestionAPI.get(4).data, 'none');
        remountAt(3);
        clearToastLog();
        const input2 = mounted.root.querySelector('.lx-fill__input');
        type(input2, '上海');
        clickSubmit(mounted.root);
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(4).data).data, 'review');
        assertToastIncludes(/正确|错题/);
    });

    it('S=简答有参考答案 A=提交文本 → R=有 toast 且 revealed', () => {
        remountAt(4);
        assertTextIncludes(mounted.root, '简答题干FIVE');
        const ta = mounted.root.querySelector('textarea');
        assertTrue(!!ta, '应有简答输入');
        type(ta, '参考答案关键词补充说明');
        clickButtonIncluding(mounted.root, /确认答案/);
        assertToastIncludes(/匹配|相似度|记录|正确|补充/);
        assertTextIncludes(mounted.root, /解析|答案|参考/);
    });

    it('S=简答无参考答案 A=提交 → R=toast 自行判定', () => {
        remountAt(5);
        assertTextIncludes(mounted.root, '简答无参考SIX');
        const ta = mounted.root.querySelector('textarea');
        type(ta, '我的作答');
        clickButtonIncluding(mounted.root, /确认答案/);
        assertToastIncludes('自行判定');
    });

    it('S=简答未答 A=直接看解析 → R=展开解析区', () => {
        remountAt(4);
        assertTextIncludes(mounted.root, '简答题干FIVE');
        clickButtonIncluding(mounted.root, /看解析/);
        assertTextIncludes(mounted.root, /解析|参考|答案/);
    });

    it('S=状态 none A=点状态徽章循环 → mastered → review → none', () => {
        remountAt(0);
        clickLabel(mounted.root, '切换状态');
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data).data, 'mastered');
        assertToastIncludes('已掌握');
        clearToastLog();
        clickLabel(mounted.root, '切换状态');
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data).data, 'review');
        clearToastLog();
        clickLabel(mounted.root, '切换状态');
        assertEqual(LX.ProgressAPI.getStatus(LX.QuestionAPI.get(1).data).data, 'none');
    });
}, { layer: 'ui', tags: ['buttons', 'study', 'card', 'sar'] });
