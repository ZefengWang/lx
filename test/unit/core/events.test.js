import { describe, it, beforeEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { createBus, Events } from '../../../src/core/events.js';

describe('core/events：总线与 listenerCount', () => {
    let bus;

    beforeEach(() => {
        bus = createBus();
    });

    it('on/emit/off 与 listenerCount', () => {
        let n = 0;
        const off = bus.on(Events.NAVIGATION_CHANGED, () => { n++; });
        assertEqual(bus.listenerCount(Events.NAVIGATION_CHANGED), 1);
        bus.emit(Events.NAVIGATION_CHANGED, {});
        assertEqual(n, 1);
        off();
        assertEqual(bus.listenerCount(Events.NAVIGATION_CHANGED), 0);
        bus.emit(Events.NAVIGATION_CHANGED, {});
        assertEqual(n, 1, 'off 后不应再触发');
    });

    it('handler 抛错不阻断后续 handler', () => {
        let ok = false;
        bus.on(Events.LIBRARY_CREATED, () => { throw new Error('boom'); });
        bus.on(Events.LIBRARY_CREATED, () => { ok = true; });
        bus.emit(Events.LIBRARY_CREATED, {});
        assertTrue(ok);
    });

    it('listenerCount() 无参返回总数', () => {
        bus.on('a', () => {});
        bus.on('b', () => {});
        bus.on('b', () => {});
        assertEqual(bus.listenerCount(), 3);
    });
}, { layer: 'core', tags: ['unit'] });
