/**
 * ProgressAPI - 进度/状态管理
 * 修复 bug 4：内存缓存 + 增量统计，避免 O(n²) localStorage parse
 * 进度键使用 q.uid（内部稳定标识），向后兼容旧数据用 q.id
 * @module api/progress
 */

import * as storage from '../core/storage.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { getState } from '../core/state.js';

/** @type {Record<string, Record<string, string>> | null} libId -> qId -> status */
let _progressMap = null;
/** @type {Record<string, {total: number, mastered: number, review: number, percent: number}>} */
let _statsCache = {};

function ensureLoaded() {
    if (_progressMap !== null) return;
    const r = storage.getProgress();
    _progressMap = r.ok ? r.data || {} : {};
}

function persist() {
    return storage.setProgress(_progressMap);
}

/**
 * 获取题目的进度 key（优先 uid，回退 id）
 */
function getQKey(q) {
    if (q.uid != null) return String(q.uid);
    if (q.id != null) return String(q.id);
    return null;
}

/**
 * 重算单题库统计（首次访问或全量重置时用）
 */
function recomputeStats(libId, questions) {
    const prog = _progressMap[libId] || {};
    let mastered = 0,
        review = 0;
    for (const q of questions) {
        const key = getQKey(q);
        const s = (key && prog[key]) || 'none';
        if (s === 'mastered') mastered++;
        else if (s === 'review') review++;
    }
    const total = questions.length;
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    _statsCache[libId] = { total, mastered, review, percent };
}

/**
 * 增量调整统计（setStatus 时调用，O(1)）
 */
function adjustStats(libId, questions, qIdKey, oldStatus, newStatus) {
    if (!_statsCache[libId]) {
        recomputeStats(libId, questions);
        return;
    }
    const s = _statsCache[libId];
    if (oldStatus === 'mastered') s.mastered--;
    else if (oldStatus === 'review') s.review--;
    if (newStatus === 'mastered') s.mastered++;
    else if (newStatus === 'review') s.review++;
    s.percent = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
}

/**
 * 获取单题状态
 * @param {Question|string|number} qId - 题目对象（推荐）或题目 id
 * @returns {Result<QuestionStatus>}
 */
export function getStatus(qId) {
    ensureLoaded();
    const libId = getState().currentLibId;
    if (!libId) return ok('none');
    const prog = _progressMap[libId] || {};
    // qId 可能是 question 对象，也可能是裸 id
    const key = qId && typeof qId === 'object' ? getQKey(qId) : String(qId);
    return ok(prog[key] || 'none');
}

/**
 * 设置单题状态
 * @param {Question|string|number} qIdOrQuestion - 题目对象（推荐）或题目 id
 * @param {QuestionStatus} status - 状态值（禁止 'pending'，只能 'none'|'mastered'|'review'）
 * @param {{ libId?: string; questions?: Question[]; source?: string }} [context] - 增量统计用
 * @returns {Result<void>}
 */
export function setStatus(qIdOrQuestion, status, context = {}) {
    ensureLoaded();
    const libId = context.libId || getState().currentLibId;
    if (!libId) {
        return err(ErrorCode.STATE_ERROR, '未选择题库');
    }
    if (!['none', 'mastered', 'review'].includes(status)) {
        return err(ErrorCode.INVALID_INPUT, '状态值无效：' + status);
    }

    const key = qIdOrQuestion && typeof qIdOrQuestion === 'object'
        ? getQKey(qIdOrQuestion)
        : String(qIdOrQuestion);
    if (!key) {
        return err(ErrorCode.INVALID_INPUT, '无法解析题目 ID');
    }

    _progressMap[libId] = _progressMap[libId] || {};
    const oldStatus = _progressMap[libId][key] || 'none';

    if (status === 'none') {
        delete _progressMap[libId][key];
    } else {
        _progressMap[libId][key] = status;
    }

    // 落盘
    const persistResult = persist();
    if (!persistResult.ok) return persistResult;

    // 增量更新统计
    if (context.questions) {
        adjustStats(libId, context.questions, key, oldStatus, status);
    } else {
        // 没传 questions，下次 stats() 时重算
        delete _statsCache[libId];
    }

    // 触发事件
    bus.emit(Events.QUESTION_STATUS_CHANGED, {
        libId,
        qId: key,
        oldStatus,
        newStatus: status,
        source: context.source || 'api',
    });
    bus.emit(Events.PROGRESS_UPDATED, {
        libId,
        stats: _statsCache[libId] || recomputeAndGetStats(libId, context.questions),
    });

    return ok();
}

function recomputeAndGetStats(libId, questions) {
    if (!questions) {
        // 无法重算，返回占位
        return { total: 0, mastered: 0, review: 0, percent: 0 };
    }
    recomputeStats(libId, questions);
    return _statsCache[libId];
}

/**
 * 重置进度
 * @param {string} [libId] - 不传则重置当前题库
 */
export function reset(libId) {
    ensureLoaded();
    const targetLibId = libId || getState().currentLibId;
    if (!targetLibId) return err(ErrorCode.STATE_ERROR, '未指定题库');

    _progressMap[targetLibId] = {};
    delete _statsCache[targetLibId];
    const r = persist();
    if (!r.ok) return r;

    bus.emit(Events.PROGRESS_RESET, { libId: targetLibId });
    return ok();
}

/**
 * 获取统计
 * @param {string} [libId]
 * @param {Question[]} [questions] - 题库题目数组（用于精确计算）
 * @returns {Result<StatsSummary>}
 */
export function stats(libId, questions) {
    ensureLoaded();
    const targetLibId = libId || getState().currentLibId;
    if (!targetLibId) {
        return ok({ total: 0, mastered: 0, review: 0, percent: 0 });
    }

    // 缓存缺失，或缓存 total 与传入 questions 长度不符（可能由部分 questions 的 setStatus 产生脏缓存）时重算
    if (questions) {
        const cached = _statsCache[targetLibId];
        if (!cached || cached.total !== questions.length) {
            recomputeStats(targetLibId, questions);
        }
    }
    return ok(_statsCache[targetLibId] || { total: 0, mastered: 0, review: 0, percent: 0 });
}

/**
 * 导出全部进度为 JSON 字符串
 */
export function exportProgress() {
    ensureLoaded();
    return ok(JSON.stringify(_progressMap, null, 2));
}

/**
 * 导入进度（覆盖式）
 * @param {string} jsonString
 */
export function importProgress(jsonString) {
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        return err(ErrorCode.PARSE_ERROR, '进度 JSON 解析失败：' + e.message);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return err(ErrorCode.INVALID_INPUT, '进度数据格式无效');
    }
    _progressMap = data;
    _statsCache = {};
    const r = persist();
    if (!r.ok) return r;

    bus.emit(Events.PROGRESS_IMPORTED, { progress: data });
    bus.emit(Events.PROGRESS_UPDATED, { libId: getState().currentLibId, stats: null });
    return ok();
}

/**
 * 清空内存缓存（库切换/外部修改时调用）
 */
export function invalidateCache() {
    _progressMap = null;
    _statsCache = {};
}

/**
 * 删除指定题库的进度（题库删除时调用）
 */
export function removeLibraryProgress(libId) {
    ensureLoaded();
    if (_progressMap[libId]) {
        delete _progressMap[libId];
        delete _statsCache[libId];
        return persist();
    }
    return ok();
}

/**
 * 直接设置题库进度（TestAPI 用）
 */
export function _setLibraryProgressRaw(libId, progressObj) {
    ensureLoaded();
    _progressMap[libId] = progressObj;
    delete _statsCache[libId];
    return persist();
}

/**
 * 获取内存中的进度对象（只读视图）
 */
export function _getProgressMap() {
    ensureLoaded();
    return _progressMap;
}

export const ProgressAPI = {
    getStatus,
    setStatus,
    reset,
    stats,
    export: exportProgress,
    import: importProgress,
    invalidateCache,
    removeLibraryProgress,
    _setLibraryProgressRaw,
    _getProgressMap,
};
