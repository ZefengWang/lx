/**
 * TestAPI - 测试辅助方法
 * 仅在 test.html 或 ?test=1 时挂载到 window.LX.TestAPI
 * 提供快照/恢复/种子/mock 能力
 *
 * 安全机制：
 * - reset()/seed()/restore() 首次调用 confirm
 * - 破坏性操作前自动 snapshot 入栈
 * - 提供 undoLast() 回滚
 * @module api/test
 */

import * as storage from '../core/storage.js';
import * as LibraryAPI from './library.js';
import * as ProgressAPI from './progress.js';
import { getState, setState, resetState, snapshotState } from '../core/state.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { bus } from '../core/events.js';
import { scenarios, scenarioNames } from '../../test/scenarios/seed.js';

const SNAPSHOT_STACK_KEY = 'lx_test_snapshots';
const MAX_UNDO = 10;
let _confirmedThisSession = false;
let _undoStack = [];

/**
 * 首次破坏性操作确认（每次会话一次，避免反复弹窗）
 */
function ensureConfirmed(action) {
    if (_confirmedThisSession) return true;
    const msg = `测试模式：即将执行 ${action}，会清空当前题库与进度数据。\n\n测试期间会自动备份，可用 LX.TestAPI.undoLast() 回滚。\n\n确认继续？`;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!window.confirm(msg)) {
            return false;
        }
        _confirmedThisSession = true;
    } else {
        // 非 DOM 环境（如 Node 测试）默认允许
        _confirmedThisSession = true;
    }
    return true;
}

/**
 * 推入撤销栈
 */
function pushUndo() {
    const snap = doSnapshot();
    _undoStack.push(snap);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    // 持久化（防止刷新丢失，最多保留最近 1 个）
    try {
        localStorage.setItem(SNAPSHOT_STACK_KEY, JSON.stringify(_undoStack.slice(-1)));
    } catch (_) {}
}

/**
 * 内部快照（无副作用）
 */
function doSnapshot() {
    const libsR = storage.getLibraries();
    const progR = storage.getProgress();
    return JSON.stringify({
        libraries: libsR.ok ? libsR.data : {},
        progress: progR.ok ? progR.data : {},
        state: snapshotState(),
        timestamp: Date.now(),
    });
}

/**
 * 清空所有数据（libraries + progress + state）
 * 首次调用会 confirm
 */
export function reset() {
    if (!ensureConfirmed('reset()')) {
        return err(ErrorCode.STATE_ERROR, '用户取消');
    }
    pushUndo();
    storage.clearAll();
    ProgressAPI.invalidateCache();
    resetState();
    bus.emit('test:reset', {});
    return ok();
}

/**
 * 注入预设场景
 * @param {string} scenarioName
 * @returns {{ok: true, data: {libIds: string[]}} | {ok: false, error}}
 */
export function seed(scenarioName) {
    if (!scenarios[scenarioName]) {
        return err(ErrorCode.NOT_FOUND, `场景不存在：${scenarioName}。可用：${scenarioNames.join(', ')}`);
    }
    if (!ensureConfirmed(`seed('${scenarioName}')`)) {
        return err(ErrorCode.STATE_ERROR, '用户取消');
    }
    pushUndo();

    // 清空
    storage.clearAll();
    ProgressAPI.invalidateCache();
    resetState();

    const scenario = scenarios[scenarioName];
    const libIds = [];

    // 创建题库
    scenario.libraries.forEach((lib, idx) => {
        const r = LibraryAPI.create(lib.name, lib.questions, { skipDuplicateCheck: true });
        if (r.ok) {
            libIds.push(r.data.id);
        }
    });

    // 设置进度
    const progressMap = {};
    Object.entries(scenario.progressByLibIndex).forEach(([libIndex, qStatusMap]) => {
        const libId = libIds[Number(libIndex)];
        if (!libId) return;
        progressMap[libId] = { ...qStatusMap };
    });

    if (Object.keys(progressMap).length > 0) {
        // 直接写入 progress（绕过事件，批量效率更高）
        const r = storage.setProgress(progressMap);
        if (!r.ok) return r;
        ProgressAPI.invalidateCache(); // 让下次 stats() 重算
    }

    // 切换到第一个题库（如果有）
    if (libIds.length > 0) {
        LibraryAPI.switchLib(libIds[0]);
    }

    bus.emit('test:seeded', { scenario: scenarioName, libIds });
    return ok({ libIds });
}

/**
 * 序列化当前状态为快照字符串
 */
export function snapshot() {
    return doSnapshot();
}

/**
 * 从快照字符串恢复
 * @param {string} snapshotString
 */
export function restore(snapshotString) {
    if (!snapshotString) {
        return err(ErrorCode.INVALID_INPUT, '快照字符串为空');
    }
    let data;
    try {
        data = JSON.parse(snapshotString);
    } catch (e) {
        return err(ErrorCode.PARSE_ERROR, '快照解析失败：' + e.message);
    }
    if (!ensureConfirmed('restore()')) {
        return err(ErrorCode.STATE_ERROR, '用户取消');
    }
    pushUndo();

    const libsR = storage.setLibraries(data.libraries || {});
    if (!libsR.ok) return libsR;
    const progR = storage.setProgress(data.progress || {});
    if (!progR.ok) return progR;
    ProgressAPI.invalidateCache();

    // 恢复 state（深合并）
    if (data.state) {
        resetState();
        setState(data.state);
    }

    bus.emit('test:restored', { timestamp: data.timestamp });
    return ok();
}

/**
 * 撤销上一次破坏性操作
 */
export function undoLast() {
    if (_undoStack.length === 0) {
        return err(ErrorCode.NOT_FOUND, '无可撤销的操作');
    }
    const snap = _undoStack.pop();
    // 直接恢复，不再 pushUndo（避免无限增长）
    let data;
    try {
        data = JSON.parse(snap);
    } catch (e) {
        return err(ErrorCode.PARSE_ERROR, '快照解析失败：' + e.message);
    }
    storage.setLibraries(data.libraries || {});
    storage.setProgress(data.progress || {});
    ProgressAPI.invalidateCache();
    resetState();
    if (data.state) setState(data.state);
    bus.emit('test:undone', { timestamp: data.timestamp });
    return ok({ remaining: _undoStack.length });
}

/**
 * 列出所有可用场景名
 */
export function listScenarios() {
    return ok(scenarioNames);
}

/**
 * 构造 File 对象（用于测试 parseFile）
 * @param {string} content
 * @param {string} name
 * @param {string} type
 */
export function mockFile(content, name = 'mock.json', type = 'application/json') {
    if (typeof File !== 'undefined') {
        return new File([content], name, { type });
    }
    // Node 环境 fallback（测试运行器可能不支持 File）
    const blob = new Blob([content], { type });
    blob.name = name;
    return blob;
}

/**
 * 构造 SheetJS workbook（用于测试 parseExcelWorkbook）
 * @param {Array<Array<any>>} rows - 二维数组（含表头）
 * @param {object} [XLSX] - 注入的 XLSX，默认 window.XLSX
 */
export function mockXLSX(rows, XLSX) {
    const xlsx = XLSX || (typeof window !== 'undefined' ? window.XLSX : null);
    if (!xlsx) {
        throw new Error('SheetJS 未加载，无法构造 mock workbook');
    }
    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    return wb;
}

/**
 * 清空撤销栈（测试用）
 */
export function _clearUndoStack() {
    _undoStack = [];
}

/**
 * 启用自动确认（测试批量运行时调用，避免反复弹窗）
 */
export function _enableAutoConfirm() {
    _confirmedThisSession = true;
}

/**
 * 事件总线监听器数量（检测 UI 订阅泄漏）
 * @param {string} [event] 不传则返回全部事件监听器总数
 * @returns {number}
 */
export function busListenerCount(event) {
    return bus.listenerCount(event);
}

/** @type {Promise<object>|null} probeUi 依赖模块缓存（避免每条 SAR 重复动态 import） */
let _probeUiMods = null;

async function loadProbeUiMods() {
    if (!_probeUiMods) {
        _probeUiMods = Promise.all([
            import('../../test/system/ui-state-collector.js'),
            import('../core/state.js'),
            import('../render/drawer.js'),
            import('../render/toast.js'),
            import('../render/confirm.js'),
            import('../render/prompt.js'),
            import('../render/download.js'),
            import('../render/session/index.js'),
        ]).then(([collector, state, drawer, toast, confirm, prompt, download, session]) => ({
            collectUiState: collector.collectUiState,
            getState: state.getState,
            drawer,
            toast,
            confirm,
            prompt,
            download,
            session,
        }));
    }
    return _probeUiMods;
}

/**
 * 采集当前窗（含 iframe app.html?test=1）整页 `#app` UI 状态。
 * 在 iframe 内调用时走本窗模块图，不会读到父页 getState / drawer / toast。
 * @returns {Promise<object>}
 */
export async function probeUi() {
    const mods = await loadProbeUiMods();
    const gs = mods.getState;
    const root = (typeof document !== 'undefined' && document.querySelector('#app')) || document?.body;
    return mods.collectUiState(root, {
        LX: typeof window !== 'undefined' ? window.LX : null,
        getWrongbookActive: () => !!gs().isWrongBookMode,
        isDrawerOpen: () => !!mods.drawer.isDrawerOpen(),
        getToastLast: () => {
            const log = typeof mods.toast.__getToastLogForTest === 'function' ? mods.toast.__getToastLogForTest() : [];
            return log.length ? log[log.length - 1].message : null;
        },
        getConfirmAsked: () => {
            const log = typeof mods.confirm.__getConfirmLogForTest === 'function' ? mods.confirm.__getConfirmLogForTest() : [];
            return log.map((e) => e.message);
        },
        getPromptAsked: () => {
            const log = typeof mods.prompt.__getPromptLogForTest === 'function' ? mods.prompt.__getPromptLogForTest() : [];
            return log.map((e) => e.message);
        },
        getDownloads: () => {
            const log = typeof mods.download.__getDownloadLogForTest === 'function' ? mods.download.__getDownloadLogForTest() : [];
            return log.map((e) => e.filename);
        },
        getUiSession: () => {
            try { return mods.session.getUiSession(); } catch (_) { return null; }
        },
        getHash: () => (typeof location !== 'undefined' ? (location.hash || '') : ''),
    });
}

export const TestAPI = {
    reset,
    seed,
    snapshot,
    restore,
    undoLast,
    listScenarios,
    mockFile,
    mockXLSX,
    busListenerCount,
    probeUi,
    _clearUndoStack,
    _enableAutoConfirm,
};
