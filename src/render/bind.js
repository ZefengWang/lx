/**
 * bind.js — 事件订阅管理工具
 *
 * 消除 render 层每页重复的「订阅 N 个事件 + onLeave 时逐个 off」boilerplate。
 * 用法见 docs/CONTRACT-api.md §9.3。
 *
 * @module render/bind
 */

/**
 * 绑定一组事件到同一个 handler，返回一个统一的取消订阅函数。
 *
 * @param {string[]} events - 事件名列表（LX.Events.*）
 * @param {Function} handler - 事件触发时的回调（所有事件共用）
 * @returns {() => void} unsubscribe — 调用一次取消所有订阅
 *
 * @example
 * const off = bindRefresh(
 *   [LX.Events.NAVIGATION_CHANGED, LX.Events.QUESTION_STATUS_CHANGED],
 *   () => refreshCard(),
 * );
 * // 离开页面时
 * off();
 */
export function bindRefresh(events, handler) {
    if (!Array.isArray(events) || events.length === 0) {
        return () => {};
    }
    const LX = window.LX;
    if (!LX || typeof LX.on !== 'function') {
        return () => {};
    }
    const unsubs = events.map((evt) => LX.on(evt, handler));
    return () => {
        for (const off of unsubs) {
            if (typeof off === 'function') off();
        }
    };
}

/**
 * 绑定多组「事件 → 各自 handler」的映射，返回统一的取消订阅函数。
 * 适合不同事件需要不同处理的场景（如 LIBRARY_SWITCHED 需清空状态再刷新）。
 *
 * @param {Record<string, Function>} bindings - { eventName: handler }
 * @returns {() => void} unsubscribe
 *
 * @example
 * const off = bindEvents({
 *   [LX.Events.NAVIGATION_CHANGED]: () => refresh(),
 *   [LX.Events.LIBRARY_SWITCHED]: () => { clearState(); refresh(); },
 * });
 */
export function bindEvents(bindings) {
    if (!bindings || typeof bindings !== 'object') {
        return () => {};
    }
    const LX = window.LX;
    if (!LX || typeof LX.on !== 'function') {
        return () => {};
    }
    const unsubs = [];
    for (const [evt, handler] of Object.entries(bindings)) {
        if (typeof handler === 'function') {
            unsubs.push(LX.on(evt, handler));
        }
    }
    return () => {
        for (const off of unsubs) {
            if (typeof off === 'function') off();
        }
    };
}
