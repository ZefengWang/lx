/**
 * 极简事件总线
 * 同步广播，handler 异常不传播
 * @module core/events
 */

export const Events = Object.freeze({
    LIBRARY_SWITCHED: 'library:switched',
    LIBRARY_CREATED: 'library:created',
    LIBRARY_DELETED: 'library:deleted',
    LIBRARY_RENAMED: 'library:renamed',

    QUESTION_ADDED: 'question:added',
    QUESTION_UPDATED: 'question:updated',
    QUESTION_DELETED: 'question:deleted',
    QUESTION_ANSWERED: 'question:answered',
    QUESTION_STATUS_CHANGED: 'question:statusChanged',

    PROGRESS_UPDATED: 'progress:updated',
    PROGRESS_RESET: 'progress:reset',
    PROGRESS_IMPORTED: 'progress:imported',

    NAVIGATION_CHANGED: 'navigation:changed',

    WRONGBOOK_ENTERED: 'wrongbook:entered',
    WRONGBOOK_EXITED: 'wrongbook:exited',
    WRONGBOOK_CLEARED: 'wrongbook:cleared',
    WRONGBOOK_MARKED: 'wrongbook:marked',

    CATEGORY_RENAMED: 'category:renamed',

    STATE_ERROR: 'state:error',

    LX_READY: 'lx:ready',
});

/**
 * 创建事件总线
 */
export function createBus() {
    /** @type {Map<string, Set<Function>>} */
    const listeners = new Map();

    return {
        /**
         * 订阅事件，返回取消订阅函数
         * @param {string} event
         * @param {(payload: any) => void} handler
         */
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
            return () => this.off(event, handler);
        },

        /**
         * 取消订阅
         */
        off(event, handler) {
            const set = listeners.get(event);
            if (set) set.delete(handler);
        },

        /**
         * 订阅一次
         */
        once(event, handler) {
            const off = this.on(event, (payload) => {
                off();
                handler(payload);
            });
            return off;
        },

        /**
         * 广播事件（同步）
         */
        emit(event, payload) {
            const set = listeners.get(event);
            if (!set || set.size === 0) return;
            // 复制避免迭代中删除
            const handlers = [...set];
            for (const h of handlers) {
                try {
                    h(payload);
                } catch (e) {
                    console.error(`[lx] event handler error for "${event}":`, e);
                    // 通知 state:error，但避免无限循环
                    if (event !== Events.STATE_ERROR) {
                        try {
                            const errSet = listeners.get(Events.STATE_ERROR);
                            if (errSet) [...errSet].forEach((eh) => eh({ event, error: e }));
                        } catch (_) {}
                    }
                }
            }
        },

        /**
         * 清空所有监听器（测试用）
         */
        clear() {
            listeners.clear();
        },

        /**
         * 监听器数量（测试用：检测订阅泄漏）
         * @param {string} [event] 不传则返回全部事件监听器总数
         * @returns {number}
         */
        listenerCount(event) {
            if (event != null) {
                const set = listeners.get(event);
                return set ? set.size : 0;
            }
            let n = 0;
            for (const set of listeners.values()) n += set.size;
            return n;
        },
    };
}

/** 全局单例 bus */
export const bus = createBus();
