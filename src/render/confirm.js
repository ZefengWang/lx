/**
 * confirm.js — 可测试的确认对话框封装
 * 生产默认走 window.confirm；测试通过 __setConfirmForTest 注入返回值并可断言文案。
 * @module render/confirm
 */

/** @type {null | ((message: string) => boolean)} */
let _confirmForTest = null;
/** @type {Array<{ message: string, result: boolean }>} */
let _confirmLogForTest = [];

/**
 * 【仅测试用】设置 confirm 实现；null 恢复 window.confirm。
 * @param {null | ((message: string) => boolean)} fn
 */
export function __setConfirmForTest(fn) {
    _confirmForTest = typeof fn === 'function' ? fn : null;
}

/** 【仅测试用】 */
export function __getConfirmLogForTest() {
    return _confirmLogForTest.slice();
}

/** 【仅测试用】 */
export function __clearConfirmLogForTest() {
    _confirmLogForTest = [];
}

/**
 * 应用内确认（替代裸 confirm / window.confirm）
 * @param {string} message
 * @returns {boolean}
 */
export function appConfirm(message) {
    const msg = String(message ?? '');
    let result;
    if (_confirmForTest) {
        result = !!_confirmForTest(msg);
    } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        result = !!window.confirm(msg);
    } else {
        result = true;
    }
    _confirmLogForTest.push({ message: msg, result });
    return result;
}
