/**
 * 测试辅助：获取 LX 实例 + 公共 beforeEach 重置
 * @module test/helpers
 */

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
    }
    LX.TestAPI.reset();
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
