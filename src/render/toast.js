/**
 * toast.js — 全局 Toast 通知
 * 用于：答题正确/错误、导入成功/失败、复制成功等瞬时反馈
 * @module render/toast
 */

import { h } from './dom.js';

let _container = null;
let _currentTimer = null;

/** @type {null | ((entry: { message: string, type: string }) => void)} */
let _toastSinkForTest = null;
/** @type {Array<{ message: string, type: string }>} */
let _toastLogForTest = [];

/**
 * 【仅测试用】设置 toast 旁路 sink；为 null 时恢复默认 DOM 展示。
 * 生产代码禁止调用。
 * @param {null | ((entry: { message: string, type: string }) => void)} sink
 */
export function __setToastSinkForTest(sink) {
    _toastSinkForTest = typeof sink === 'function' ? sink : null;
}

/** 【仅测试用】读取 toast 记录（调用 toast 时总会写入，无论是否有 sink） */
export function __getToastLogForTest() {
    return _toastLogForTest.slice();
}

/** 【仅测试用】清空 toast 记录 */
export function __clearToastLogForTest() {
    _toastLogForTest = [];
}

/**
 * 获取/创建 toast 容器（懒加载）
 * @returns {HTMLElement}
 */
function ensureContainer() {
    if (_container && document.body.contains(_container)) return _container;

    _container = h('div', { class: 'lx-toast-container', 'aria-live': 'polite', 'aria-atomic': 'true' });
    _container.style.position = 'fixed';
    _container.style.pointerEvents = 'none';
    _container.style.zIndex = '400';
    _container.style.left = '0';
    _container.style.right = '0';
    _container.style.bottom = '0';
    _container.style.top = '0';
    _container.style.display = 'flex';
    _container.style.alignItems = 'flex-end';
    _container.style.justifyContent = 'center';
    _container.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(_container);
    return _container;
}

/**
 * 显示一条 toast
 * @param {string} message
 * @param {{type?: 'default'|'success'|'warning'|'danger'|'info'|'primary', duration?: number}} [opts]
 */
export function toast(message, opts = {}) {
    const { type = 'default', duration = 2000 } = opts;
    const entry = { message: String(message ?? ''), type };
    _toastLogForTest.push(entry);
    if (_toastSinkForTest) {
        try { _toastSinkForTest(entry); } catch (_) { /* ignore sink errors */ }
        return;
    }

    const container = ensureContainer();

    // 清掉前一个 toast（同时清掉定时器）
    if (_currentTimer) {
        clearTimeout(_currentTimer);
        _currentTimer = null;
    }
    while (container.firstChild) container.removeChild(container.firstChild);

    const el = h('div', {
        class: `lx-toast lx-toast--${type} lx-toast--visible`,
        role: 'status',
    }, [message]);
    container.appendChild(el);

    // 强制 reflow 让动画起效
    void el.offsetHeight;

    _currentTimer = setTimeout(() => {
        el.classList.remove('lx-toast--visible');
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 250);
        _currentTimer = null;
    }, duration);
}

export const toastSuccess = (msg, opts) => toast(msg, { ...opts, type: 'success' });
export const toastWarning = (msg, opts) => toast(msg, { ...opts, type: 'warning' });
export const toastDanger  = (msg, opts) => toast(msg, { ...opts, type: 'danger' });
export const toastInfo     = (msg, opts) => toast(msg, { ...opts, type: 'info' });
export const toastPrimary  = (msg, opts) => toast(msg, { ...opts, type: 'primary' });   /* 跟随主题色的确认提示 */
