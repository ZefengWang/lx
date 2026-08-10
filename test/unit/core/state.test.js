import { describe, it, beforeEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { getState, setState, resetState, subscribe } from '../../../src/core/state.js';

describe('core/state：集中状态', () => {
    beforeEach(() => {
        resetState();
    });

    it('setState 浅合并 + subscribe 通知', () => {
        let seen = null;
        const off = subscribe((next) => { seen = next.mode; });
        setState({ mode: 'random' });
        assertEqual(getState().mode, 'random');
        assertEqual(seen, 'random');
        off();
        setState({ mode: 'sequential' });
        assertEqual(seen, 'random', '取消订阅后不应再更新 seen');
    });

    it('resetState 恢复默认', () => {
        setState({ currentLibId: 'lib_x', isWrongBookMode: true });
        resetState();
        assertEqual(getState().currentLibId, null);
        assertTrue(getState().isWrongBookMode === false);
    });
}, { layer: 'core', tags: ['unit'] });
