import { describe, it, beforeEach, afterEach } from '../runner.js';
import { assertTrue, assertEqual } from '../assert.js';
import {
    getLX,
    resetStateBeforeEach,
    busListenerCount,
    createMountPoint,
    destroyMountPoint,
    createAndSwitchLibrary,
} from '../helpers.js';
import { createStudyPage } from '../../src/render/pages/study.js';

/**
 * UI 生命周期：study 进出页不得泄漏事件订阅
 */
describe('UI 生命周期：study onLeave 解绑', () => {
    let LX;
    let mount;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        createAndSwitchLibrary('生命周期库', [
            { id: 1, type: 'single', question: 'q1', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        mount = createMountPoint();
    });

    afterEach(() => {
        destroyMountPoint(mount);
        mount = null;
    });

    it('进入→离开 study 后 NAVIGATION_CHANGED 监听数不增加', () => {
        const baseline = busListenerCount(LX.Events.NAVIGATION_CHANGED);

        const page1 = createStudyPage();
        page1.render(mount);
        const afterEnter = busListenerCount(LX.Events.NAVIGATION_CHANGED);
        assertTrue(afterEnter > baseline, '进入 study 应新增订阅');

        page1.onLeave();
        const afterLeave = busListenerCount(LX.Events.NAVIGATION_CHANGED);
        assertEqual(afterLeave, baseline, 'onLeave 后应回到进入前的监听数');

        // 再次进出，确认不累计
        const page2 = createStudyPage();
        page2.render(mount);
        page2.onLeave();
        assertEqual(
            busListenerCount(LX.Events.NAVIGATION_CHANGED),
            baseline,
            '第二次进出后仍不应泄漏'
        );
    });
}, { layer: 'ui', tags: ['lifecycle', 'leak'] });
