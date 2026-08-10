import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createStudyPage, __setDrillWrongDelayForTest } from '../../../src/render/pages/study.js';
import {
    mountPage, assertTextIncludes, preserveHash,
    installToastSpy, clearToastLog,
} from '../dom-harness.js';

function clickOption(root, index) {
    const opts = root.querySelectorAll('.lx-option');
    assertTrue(opts.length > index, `应有选项 index=${index}`);
    opts[index].click();
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * SAR：刷题页练习会话（快速答对/答错；背诵答对/答错不推进）
 */
describe('UI：刷题页练习会话（快速 / 背诵）', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        __setDrillWrongDelayForTest(null);
        createAndSwitchLibrary('练习会话UI库', [
            {
                id: 1, type: 'single', question: 'DRILL_UI_Q1',
                options: ['甲正确', '乙错误'], answer: 'A', category: '练',
            },
            {
                id: 2, type: 'single', question: 'DRILL_UI_Q2',
                options: ['甲正确', '乙错误'], answer: 'A', category: '练',
            },
            {
                id: 3, type: 'single', question: 'DRILL_UI_Q3',
                options: ['甲正确', '乙错误'], answer: 'A', category: '练',
            },
        ]);
        clearToastLog();
    });

    afterEach(() => {
        __setDrillWrongDelayForTest(null);
        if (LX?.DrillAPI?.isActive()) LX.DrillAPI.exit();
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    it('S=快速刷题 A=答对 → R=自动下一题且进度前进', () => {
        assertOkStart(LX.DrillAPI.start({ mode: 'quick', count: 3 }));
        mounted = mountPage(createStudyPage);
        assertTextIncludes(mounted.root, '快速刷题');
        assertTextIncludes(mounted.root, 'DRILL_UI_');
        const first = LX.DrillAPI.current().data.qId;
        clickOption(mounted.root, 0); // A 正确 → delay 0 立即推进
        const next = LX.DrillAPI.current().data;
        assertTrue(next.qId !== first, '答对应切到下一题');
        assertEqual(next.progressIndex, 1);
        assertTextIncludes(mounted.root, '2/3');
    });

    it('S=快速刷题 A=答错 → R=短延时后下一题', async () => {
        __setDrillWrongDelayForTest(40);
        assertOkStart(LX.DrillAPI.start({ mode: 'quick', count: 3 }));
        mounted = mountPage(createStudyPage);
        const first = LX.DrillAPI.current().data.qId;
        clickOption(mounted.root, 1); // B 错误
        assertEqual(LX.DrillAPI.current().data.qId, first, '答错瞬间应仍停在当前题');
        await sleep(80);
        assertTrue(LX.DrillAPI.current().data.qId !== first, '延时后应自动下一题');
    });

    it('S=背诵记忆 A=答对 → R=仍停在当前题', () => {
        assertOkStart(LX.DrillAPI.start({ mode: 'memory', count: 2 }));
        mounted = mountPage(createStudyPage);
        assertTextIncludes(mounted.root, '背诵记忆');
        const first = LX.DrillAPI.current().data.qId;
        clickOption(mounted.root, 0);
        assertEqual(LX.DrillAPI.current().data.qId, first);
        assertEqual(LX.DrillAPI.current().data.progressIndex, 0);
        assertTextIncludes(mounted.root, '1/2');
    });

    it('S=背诵记忆 A=答错 → R=仍停在当前题（不自动推进）', () => {
        assertOkStart(LX.DrillAPI.start({ mode: 'memory', count: 2 }));
        mounted = mountPage(createStudyPage);
        const first = LX.DrillAPI.current().data.qId;
        clickOption(mounted.root, 1); // B 错误
        assertEqual(LX.DrillAPI.current().data.qId, first, '背诵答错也不应自动下一题');
        assertEqual(LX.DrillAPI.current().data.progressIndex, 0);
        assertTextIncludes(mounted.root, '1/2');
    });
}, { layer: 'ui', tags: ['buttons', 'drill', 'study', 'sar'] });

function assertOkStart(r) {
    assertTrue(r.ok, r.error?.message || 'DrillAPI.start 应成功');
}
