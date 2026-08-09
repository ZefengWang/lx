/**
 * 通用工具函数（无 DOM 依赖部分 + 必要的轻量 DOM 工具）
 * @module utils
 */

/**
 * HTML 转义，防止 XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * 浅拷贝 + Fisher-Yates 洗牌
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 复制文本到剪贴板，优先用 Clipboard API，失败则降级 execCommand
 * @param {string} text
 * @returns {Promise<{ok: true} | {ok: false, error: {code: string, message: string}}>}
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return { ok: true };
        } catch (_) {
            // fallthrough to fallback
        }
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.setAttribute('readonly', '');
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const success = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!success) {
            return { ok: false, error: { code: 'COPY_FAILED', message: '复制失败' } };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: { code: 'COPY_FAILED', message: e?.message || '复制失败' } };
    }
}

/**
 * 字节数格式化
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * sleep
 * @param {number} ms
 */
export function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * debounce
 * @template A
 * @param {(...args: A) => void} fn
 * @param {number} delay
 */
export function debounce(fn, delay = 200) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 简单字符串哈希（djb2 变体），用于题库指纹
 * @param {string} str
 * @returns {string} 16 进制哈希
 */
export function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
}

/**
 * 限制字符串长度，超出用省略号
 * @param {string} str
 * @param {number} max
 */
export function truncate(str, max = 30) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * 深拷贝（基于 structuredClone 优先，降级到 JSON）
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch (_) {
            // fallthrough
        }
    }
    return JSON.parse(JSON.stringify(obj));
}
