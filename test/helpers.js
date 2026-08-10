/**
 * 测试辅助：获取 LX 实例 + 公共 beforeEach 重置 + UI 挂载点
 * @module test/helpers
 */

import { __setConfirmForTest } from '../src/render/confirm.js';

/**
 * 获取 window.LX（测试运行时保证已就绪）
 */
export function getLX() {
    if (typeof window === 'undefined' || !window.LX) {
        throw new Error('window.LX 未就绪，请确保 test.html 已加载 main.js');
    }
    return window.LX;
}

/**
 * 事件总线监听器数量（需 TestAPI；检测订阅泄漏）
 * @param {string} [event]
 * @returns {number}
 */
export function busListenerCount(event) {
    const LX = getLX();
    if (!LX.TestAPI || typeof LX.TestAPI.busListenerCount !== 'function') {
        throw new Error('LX.TestAPI.busListenerCount 不可用（请用 test.html 打开）');
    }
    return LX.TestAPI.busListenerCount(event);
}

/**
 * 创建临时 DOM 挂载点（UI 测试用）
 * @returns {HTMLElement}
 */
export function createMountPoint() {
    const el = document.createElement('div');
    el.setAttribute('data-lx-test-mount', '1');
    el.style.cssText = 'position:absolute;left:-9999px;top:0;width:360px;';
    document.body.appendChild(el);
    return el;
}

/**
 * 销毁挂载点
 * @param {HTMLElement|null} el
 */
export function destroyMountPoint(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

/**
 * 构造含指定题型的最小题库并切换过去
 * @param {string} name
 * @param {object[]} questions
 * @returns {{ libId: string, questions: object[] }}
 */
export function createAndSwitchLibrary(name, questions) {
    const LX = getLX();
    const r = LX.LibraryAPI.create(name, questions);
    if (!r.ok) throw new Error('createAndSwitchLibrary 失败：' + (r.error && r.error.message));
    LX.LibraryAPI.switch(r.data.id);
    return { libId: r.data.id, questions: r.data.questions || questions };
}

/**
 * 是否已自动确认
 */
let _autoConfirmed = false;

/**
 * 公共 beforeEach：自动确认 + reset
 * 每个测试套件在 beforeEach 中调用此函数即可
 */
export async function resetStateBeforeEach() {
    const LX = getLX();
    if (!_autoConfirmed) {
        LX.TestAPI._enableAutoConfirm();
        _autoConfirmed = true;
        // UI 按钮测会点到 confirm；优先走 appConfirm 钩子，并兼容裸 window.confirm
        __setConfirmForTest(() => true);
        if (typeof window !== 'undefined') {
            window.confirm = () => true;
            window.prompt = (msg, def) => (def == null ? '' : String(def));
        }
    } else {
        // 每个 beforeEach 都重新钉死钩子：防止某用例 installConfirmSpy(false) 卸载后回落原生弹窗
        __setConfirmForTest(() => true);
        if (typeof window !== 'undefined') {
            window.confirm = () => true;
            window.prompt = (msg, def) => (def == null ? '' : String(def));
        }
    }
    LX.TestAPI.reset();
    try {
        const { __resetUiSessionForTest } = await import('../src/render/session/index.js');
        __resetUiSessionForTest();
    } catch (_) { /* ignore */ }
}

/**
 * 等待 LX 就绪（test.html 启动时调用）
 * @returns {Promise<object>}
 */
export function waitForLX(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.LX) {
            resolve(window.LX);
            return;
        }
        const timer = setTimeout(() => {
            window.removeEventListener('lx:ready', onReady);
            reject(new Error(`等待 LX 就绪超时（${timeout}ms）`));
        }, timeout);
        const onReady = () => {
            clearTimeout(timer);
            window.removeEventListener('lx:ready', onReady);
            // 给 TestAPI 异步加载留时间
            setTimeout(() => resolve(window.LX), 50);
        };
        window.addEventListener('lx:ready', onReady);
    });
}
