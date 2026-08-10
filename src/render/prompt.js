/**
 * prompt.js — 可测试的输入对话框封装
 * @module render/prompt
 */

/** @type {null | ((message: string, defaultValue?: string) => string|null)} */
let _promptForTest = null;
/** @type {Array<{ message: string, defaultValue: string, result: string|null }>} */
let _promptLogForTest = [];

/**
 * 【仅测试用】
 * @param {null | ((message: string, defaultValue?: string) => string|null)} fn
 */
export function __setPromptForTest(fn) {
    _promptForTest = typeof fn === 'function' ? fn : null;
}

/** 【仅测试用】 */
export function __getPromptLogForTest() {
    return _promptLogForTest.slice();
}

/** 【仅测试用】 */
export function __clearPromptLogForTest() {
    _promptLogForTest = [];
}

/**
 * @param {string} message
 * @param {string} [defaultValue]
 * @returns {string|null}
 */
export function appPrompt(message, defaultValue = '') {
    const msg = String(message ?? '');
    const def = defaultValue == null ? '' : String(defaultValue);
    let result;
    if (_promptForTest) {
        result = _promptForTest(msg, def);
        if (result !== null && result !== undefined) result = String(result);
        else result = null;
    } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        result = window.prompt(msg, def);
    } else {
        result = def;
    }
    _promptLogForTest.push({ message: msg, defaultValue: def, result });
    return result;
}
