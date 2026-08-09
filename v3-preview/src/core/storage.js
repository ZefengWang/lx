/**
 * localStorage 抽象层
 * - 统一 try/catch 与 QuotaExceededError 兜底（修复 bug 3）
 * - 内存缓存（修复 bug 4 基础）
 * - 旧键迁移到 lx_* 新前缀，旧键保留作 7 天备份
 * - 多标签页同步（storage 事件清缓存）
 * @module core/storage
 */

import { ok, err, ErrorCode } from './errors.js';

export const KEYS = Object.freeze({
    LIBRARIES: 'lx_libraries_v1',
    PROGRESS: 'lx_progress_v1',
    LAST_LIB: 'lx_last_library_v1',
    MIGRATED: 'lx_migrated',
    TEST_SNAPSHOTS: 'lx_test_snapshots',
    LEGACY: Object.freeze({
        LIBRARIES: 'studyLibraries_v4',
        PROGRESS: 'studyProgress_v4',
        LAST_LIB: 'lastLibraryId',
    }),
});

/** @type {Record<string, any> | null} */
let _libsCache = null;
/** @type {Record<string, any> | null} */
let _progressCache = null;
/** @type {string | null | undefined} undefined=未加载, null=无值 */
let _lastLibCache = undefined;

/**
 * 安全读取 localStorage
 * @param {string} key
 * @returns {string | null}
 */
function safeGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

/**
 * 安全写入 localStorage（修复 bug 3：捕获 QuotaExceededError）
 * @param {string} key
 * @param {string} value
 */
function safeSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return ok();
    } catch (e) {
        const name = e && e.name;
        const code = e && (e.code);
        if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
            return err(ErrorCode.STORAGE_FULL, '存储空间已满，请导出备份后清理', { key, cause: e?.message });
        }
        return err(ErrorCode.STORAGE_ERROR, e?.message || '存储错误', { key });
    }
}

/**
 * 安全删除 localStorage
 * @param {string} key
 */
function safeRemove(key) {
    try {
        localStorage.removeItem(key);
        return ok();
    } catch (e) {
        return err(ErrorCode.STORAGE_ERROR, e?.message, { key });
    }
}

/**
 * 一次性迁移旧键到新键
 * 仅在 lx_migrated 标记未设置时执行；旧键保留不删
 */
export function migrateLegacyKeys() {
    if (safeGet(KEYS.MIGRATED) === '1') {
        return ok({ migrated: false, reason: 'already' });
    }

    // 新键已有内容（用户在新版本中已操作过），直接标记迁移完成
    const newLibs = safeGet(KEYS.LIBRARIES);
    if (newLibs) {
        safeSet(KEYS.MIGRATED, '1');
        return ok({ migrated: false, reason: 'new-exists' });
    }

    const legacyLibs = safeGet(KEYS.LEGACY.LIBRARIES);
    if (!legacyLibs) {
        safeSet(KEYS.MIGRATED, '1');
        return ok({ migrated: false, reason: 'no-legacy' });
    }

    // 执行迁移
    const r1 = safeSet(KEYS.LIBRARIES, legacyLibs);
    if (!r1.ok) return r1;

    const legacyProgress = safeGet(KEYS.LEGACY.PROGRESS);
    if (legacyProgress) {
        const r2 = safeSet(KEYS.PROGRESS, legacyProgress);
        if (!r2.ok) return r2;
    }

    const legacyLastLib = safeGet(KEYS.LEGACY.LAST_LIB);
    if (legacyLastLib) {
        const r3 = safeSet(KEYS.LAST_LIB, legacyLastLib);
        if (!r3.ok) return r3;
    }

    safeSet(KEYS.MIGRATED, '1');

    // 打印迁移摘要
    let libCount = 0;
    try {
        libCount = Object.keys(JSON.parse(legacyLibs)).length;
    } catch (_) {}
    console.log(`[lx] 数据迁移完成：${libCount} 个题库。旧键已保留作为备份，7 天后可手动清理。`);

    return ok({ migrated: true, libCount });
}

/**
 * 获取所有题库（带缓存）
 * @returns {{ok: true, data: Record<string, any>} | {ok: false, error: any}}
 */
export function getLibraries() {
    if (_libsCache !== null) return ok(_libsCache);
    const raw = safeGet(KEYS.LIBRARIES);
    if (!raw) {
        _libsCache = {};
        return ok(_libsCache);
    }
    try {
        _libsCache = JSON.parse(raw);
        return ok(_libsCache);
    } catch (e) {
        return err(ErrorCode.STORAGE_ERROR, '题库数据解析失败', { cause: e?.message });
    }
}

/**
 * 写入所有题库
 * @param {Record<string, any>} obj
 */
export function setLibraries(obj) {
    const r = safeSet(KEYS.LIBRARIES, JSON.stringify(obj));
    if (!r.ok) return r;
    _libsCache = obj;
    return ok();
}

/**
 * 获取所有进度（带缓存）
 * @returns {{ok: true, data: Record<string, any>} | {ok: false, error: any}}
 */
export function getProgress() {
    if (_progressCache !== null) return ok(_progressCache);
    const raw = safeGet(KEYS.PROGRESS);
    if (!raw) {
        _progressCache = {};
        return ok(_progressCache);
    }
    try {
        _progressCache = JSON.parse(raw);
        return ok(_progressCache);
    } catch (e) {
        return err(ErrorCode.STORAGE_ERROR, '进度数据解析失败', { cause: e?.message });
    }
}

/**
 * 写入进度
 * @param {Record<string, any>} obj
 */
export function setProgress(obj) {
    const r = safeSet(KEYS.PROGRESS, JSON.stringify(obj));
    if (!r.ok) return r;
    _progressCache = obj;
    return ok();
}

/**
 * 获取上次使用的题库 ID
 * @returns {{ok: true, data: string | null}}
 */
export function getLastLibraryId() {
    if (_lastLibCache !== undefined) return ok(_lastLibCache);
    const raw = safeGet(KEYS.LAST_LIB);
    _lastLibCache = raw || null;
    return ok(_lastLibCache);
}

/**
 * 设置上次使用的题库 ID
 * @param {string | null} id
 */
export function setLastLibraryId(id) {
    const r = id ? safeSet(KEYS.LAST_LIB, id) : safeRemove(KEYS.LAST_LIB);
    if (!r.ok) return r;
    _lastLibCache = id || null;
    return ok();
}

/**
 * 清空所有题库 + 进度 + lastLibrary（不删 test snapshots）
 */
export function clearAll() {
    const r1 = safeRemove(KEYS.LIBRARIES);
    if (!r1.ok) return r1;
    const r2 = safeRemove(KEYS.PROGRESS);
    if (!r2.ok) return r2;
    const r3 = safeRemove(KEYS.LAST_LIB);
    if (!r3.ok) return r3;
    _libsCache = {};
    _progressCache = {};
    _lastLibCache = null;
    return ok();
}

/**
 * 估算 localStorage 使用情况
 * @returns {{ok: true, data: {usedBytes: number, quotaBytes: number}}}
 */
export function estimateUsage() {
    let usedBytes = 0;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || '';
            const val = localStorage.getItem(key) || '';
            usedBytes += (key.length + val.length) * 2; // UTF-16
        }
    } catch (_) {}
    return ok({ usedBytes, quotaBytes: 5 * 1024 * 1024 });
}

/**
 * 清空所有内存缓存（多标签页同步、强制重读时使用）
 */
export function invalidateCache() {
    _libsCache = null;
    _progressCache = null;
    _lastLibCache = undefined;
}

// 监听 storage 事件，多标签页同步清缓存
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
        if (!e.key) {
            invalidateCache();
            return;
        }
        if (e.key === KEYS.LIBRARIES) _libsCache = null;
        if (e.key === KEYS.PROGRESS) _progressCache = null;
        if (e.key === KEYS.LAST_LIB) _lastLibCache = undefined;
    });
}
