import { describe, it, beforeEach, afterEach } from '../runner.js';
import { assertNavigatedTo, mountPage, resetHarnessForFullRun, clickText } from './dom-harness.js';
import { resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';
import { __setNavigateHookForTest } from '../../src/render/router.js';
import { createHomePage } from '../../src/render/pages/home.js';

/**
 * 回归：二次「运行全部」时 navigate 钩子被 router-hook afterEach 卸成 null，
 * 但 harness 的 _navSpyOn 仍为 true → 若不重钉则「钩子未记录到任何 navigate」。
 */
describe('回归：harness 二次运行重钉 navigate', () => {
    let mounted;

    beforeEach(async () => {
        await resetStateBeforeEach();
        createAndSwitchLibrary('重钉导航库', [
            { id: 1, type: 'essay', question: '重钉题', answer: '' },
        ]);
        // 模拟「上一轮运行」已装过 spy
        resetHarnessForFullRun();
        mounted = mountPage(createHomePage);
        // 模拟 router-hook afterEach：只卸钩子、不通知 harness
        __setNavigateHookForTest(null);
        mounted.destroy();
        // 下一轮 mount（同 ensureNavigateSpy 路径）必须能重钉
        mounted = mountPage(createHomePage);
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
    });

    it('S=钩子已被卸 null 且曾装过 spy A=点开始学习 → R=仍记录 navigate study', () => {
        clickText(mounted.root, '开始学习');
        assertNavigatedTo('study');
    });
}, { layer: 'ui', tags: ['regression', 'harness', 'sar'] });
