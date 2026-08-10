/**
 * 启动引导
 * 顺序：file:// 提示 → 旧键迁移 → 依赖注入 → 挂载 LX → 条件挂 TestAPI → 派发 lx:ready
 * @module bootstrap
 */

import { migrateLegacyKeys, getLastLibraryId, setLastLibraryId, getLibraries } from './core/storage.js';
import { setState } from './core/state.js';
import { mountLX } from './api/index.js';
import { configurePdfWorker } from './core/parsers/pdf.js';
import * as IOAPI from './api/io.js';

const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * 判断是否处于测试模式
 */
function isTestMode() {
    if (typeof window === 'undefined' || typeof location === 'undefined') return false;
    if (location.pathname.endsWith('test.html')) return true;
    return new URLSearchParams(location.search).get('test') === '1';
}

/**
 * 启动应用
 * @returns {Promise<object>} window.LX
 */
export async function bootstrap() {
    // 1. file:// 协议提示
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
        console.warn(
            '[lx] file:// 协议下 ES Module 加载可能受限。\n' +
                '建议运行：python3 -m http.server 8080 然后访问 http://localhost:8080/'
        );
    }

    // 2. 旧键迁移（仅在首次执行，幂等）
    try {
        const r = migrateLegacyKeys();
        if (!r.ok) {
            console.warn('[lx] 数据迁移失败：', r.error);
        }
    } catch (e) {
        console.warn('[lx] 数据迁移异常：', e);
    }

    // 3. 注入依赖到 IOAPI
    if (typeof window !== 'undefined') {
        IOAPI._injectDeps({
            XLSX: window.XLSX,
            pdfjsLib: window.pdfjsLib,
        });

        // 配置 PDF.js worker
        if (window.pdfjsLib) {
            try {
                configurePdfWorker(window.pdfjsLib, PDF_WORKER_URL);
            } catch (e) {
                console.warn('[lx] PDF.js worker 配置失败：', e);
            }
        }
    }

    // 4. 挂载 window.LX
    const LX = mountLX();

    // 4.5 恢复上次使用的题库（持久化 currentLibId，修复"刷新后回到空题库"BUG）
    //     注意：这里只静默恢复 currentLibId，不派发 LIBRARY_SWITCHED（UI 还没就绪）；
    //     NavigationAPI.current() 会在首次渲染时懒重建 filteredQIds。
    try {
        const lastR = getLastLibraryId();
        if (lastR.ok && lastR.data) {
            const libsR = getLibraries();
            if (libsR.ok && libsR.data && libsR.data[lastR.data]) {
                setState({ currentLibId: lastR.data });
            } else {
                // lastLibId 已失效（题库被删），清掉避免下次还指向幽灵
                setLastLibraryId(null);
            }
        }
    } catch (e) {
        console.warn('[lx] 恢复上次题库失败：', e);
    }

    // 5. 测试模式：卸掉 SW + 清缓存，避免旧 cache-first 资源挡新版本
    if (isTestMode()) {
        try {
            if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
                // 5a. 注销所有 SW
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
                // 5b. 主动清除所有 lx- 开头的 CacheStorage（关键！SW 卸载了缓存还留着）
                if (typeof caches !== 'undefined') {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        if (name.startsWith('lx-')) {
                            await caches.delete(name);
                            console.info('[lx] 已清除 SW 缓存:', name);
                        }
                    }
                }
                // 5c. 硬刷新：让 app.html 自身也绕过缓存（通过 meta refresh）
                // 这里不做，只清 SW 缓存；app.html 的刷新由用户手动完成
            }
        } catch (e) {
            console.warn('[lx] 测试模式卸载 SW / 清缓存失败：', e);
        }
        try {
            const mod = await import('./api/test.js');
            LX.TestAPI = mod.TestAPI;
            LX._isTestMode = true;
            console.info('[lx] 测试模式已启用，LX.TestAPI 可用');
        } catch (e) {
            console.error('[lx] TestAPI 加载失败：', e);
        }
    }

    // 6. 派发就绪事件
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lx:ready', { detail: { version: LX.version } }));
    }

    console.log(`[lx] ready, version: ${LX.version}${LX._isTestMode ? ' (test mode)' : ''}`);
    return LX;
}
