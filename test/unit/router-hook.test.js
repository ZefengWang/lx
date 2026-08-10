import { describe, it, beforeEach, afterEach } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import {
    navigate,
    register,
    __setNavigateHookForTest,
} from '../../src/render/router.js';

describe('core-adjacent：router navigate 测试钩子', () => {
    let calls;

    beforeEach(() => {
        calls = [];
        // 本套件独占钩子；afterEach 卸掉即可。
        // 注意：不可依赖「卸成 null 后别的套件仍能用」——UI harness 会在 mount 时重钉。
        __setNavigateHookForTest((name, params) => {
            calls.push({ name, params });
        });
        // 保证 study 可真正改 hash（副作用仍保留）
        register('study', '#/study', () => ({ render() {} }));
        register('help', '#/help', () => ({ render() {} }));
    });

    afterEach(() => {
        // 卸钩子；二次「运行全部」时由 dom-harness.ensureNavigateSpy 重新钉死
        __setNavigateHookForTest(null);
    });

    it('钩子在路由表查找前触发，记录意图', () => {
        navigate('study');
        assertEqual(calls.length, 1);
        assertEqual(calls[0].name, 'study');
    });

    it('未 register 的路由：钩子仍能收到意图', () => {
        navigate('not-registered-route');
        assertEqual(calls.length, 1);
        assertEqual(calls[0].name, 'not-registered-route');
    });

    it('清除钩子后不再回调', () => {
        __setNavigateHookForTest(null);
        navigate('help');
        assertEqual(calls.length, 0);
    });

    it('生产默认无钩子时 navigate 仍可用', () => {
        __setNavigateHookForTest(null);
        navigate('study');
        assertTrue((location.hash || '').includes('study'));
    });
}, { layer: 'ui', tags: ['hook', 'router'] });
