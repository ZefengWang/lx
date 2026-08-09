/**
 * 集中状态 store
 * 取代 app.js 中散落的 13 个全局状态变量（L55-L70）
 * 取代 4 个 savedXxxBeforeWrongBook 变量（用 wrongBookSnapshot 统一管理）
 * @module core/state
 */

import { deepClone } from '../utils.js';

export const initialState = Object.freeze({
    currentLibId: null,        // 当前题库 ID
    mode: 'sequential',        // 'sequential' | 'random'
    category: 'all',           // 当前分类筛选
    statusFilter: 'all',      // 'all' | 'none' | 'mastered' | 'review'

    isWrongBookMode: false,    // 是否在错题专注模式
    /** @type {{category: string, mode: string, index: number, statusFilter: string} | null} */
    wrongBookSnapshot: null,   // 进入错题本前的快照

    lastIndex: 0,              // 当前题目索引（在 filteredQIds 中）
    lastQId: null,             // 当前题目 ID（与 lastIndex 双向冗余，便于断点恢复）

    /** @type {(string|number)[]} */
    filteredQIds: [],           // 当前筛选后的题目 ID 顺序列表

    uiVisibility: Object.freeze({
        mnemonic: false,
        answer: false,
        remark: false,
    }),
});

let _state = unfreezeClone(initialState);
const listeners = new Set();

function unfreezeClone(obj) {
    // initialState 用了 Object.freeze，这里做一个可变副本
    return {
        ...obj,
        wrongBookSnapshot: null,
        filteredQIds: [],
        uiVisibility: { ...obj.uiVisibility },
    };
}

/**
 * 获取当前状态（只读视图，修改请用 setState）
 */
export function getState() {
    return _state;
}

/**
 * 浅合并更新状态
 * @param {Partial<typeof initialState>} patch
 * @returns {typeof initialState} 新状态
 */
export function setState(patch) {
    const prevState = _state;
    const next = { ...prevState, ...patch };
    // uiVisibility 浅合并
    if (patch.uiVisibility) {
        next.uiVisibility = { ...prevState.uiVisibility, ...patch.uiVisibility };
    }
    _state = next;
    // 通知订阅者
    for (const l of [...listeners]) {
        try {
            l(_state, prevState);
        } catch (e) {
            console.error('[lx] state listener error:', e);
        }
    }
    return _state;
}

/**
 * 订阅状态变更
 * @param {(newState: typeof initialState, prevState: typeof initialState) => void} listener
 * @returns {() => void} 取消订阅
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * 重置状态（测试用）
 */
export function resetState() {
    const prev = _state;
    _state = unfreezeClone(initialState);
    for (const l of [...listeners]) {
        try {
            l(_state, prev);
        } catch (e) {
            console.error('[lx] state listener error:', e);
        }
    }
    return _state;
}

/**
 * 深拷贝当前状态（调试/快照用）
 */
export function snapshotState() {
    return deepClone(_state);
}
