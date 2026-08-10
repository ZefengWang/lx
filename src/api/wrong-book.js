/**
 * WrongBookAPI - 错题专注模式
 * 与 statusFilter 解耦（不修改筛选器），用独立 isWrongBookMode 标记
 * 取代 4 个 savedXxxBeforeWrongBook 变量
 * @module api/wrong-book
 */

import { getState, setState } from '../core/state.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import * as LibraryAPI from './library.js';
import * as ProgressAPI from './progress.js';
import * as storage from '../core/storage.js';

/**
 * 错题数
 */
export function count() {
    const state = getState();
    if (!state.currentLibId) return ok(0);
    const r = LibraryAPI.currentQuestions();
    if (!r.ok) return ok(0);
    const wrongCount = r.data.filter((q) => ProgressAPI.getStatus(q).data === 'review').length;
    return ok(wrongCount);
}

/**
 * 错题列表
 */
export function list() {
    const state = getState();
    if (!state.currentLibId) return ok({ questions: [], count: 0 });
    const r = LibraryAPI.currentQuestions();
    if (!r.ok) return r;
    const wrong = r.data.filter((q) => ProgressAPI.getStatus(q).data === 'review');
    return ok({ questions: wrong, count: wrong.length });
}

/**
 * 进入错题专注模式
 */
export function enter() {
    const state = getState();
    if (state.isWrongBookMode) {
        const c = count();
        return ok({ wrongCount: c.ok ? c.data : 0 });
    }
    if (!state.currentLibId) {
        return err(ErrorCode.STATE_ERROR, '未选择题库');
    }
    const c = count();
    const wrongCount = c.ok ? c.data : 0;
    if (wrongCount === 0) {
        return err(ErrorCode.NO_WRONG, '暂无错题，加油！');
    }
    // 快照当前状态，用于退出时恢复；与搜索队列互斥
    setState({
        isWrongBookMode: true,
        searchPlaylist: null,
        wrongBookSnapshot: {
            category: state.category,
            mode: state.mode,
            index: state.lastIndex,
            statusFilter: state.statusFilter,
        },
    });
    bus.emit(Events.WRONGBOOK_ENTERED, { wrongCount });
    bus.emit(Events.NAVIGATION_CHANGED, { source: 'wrongbook-enter' });
    return ok({ wrongCount });
}

/**
 * 退出错题专注模式
 */
export function exit() {
    const state = getState();
    if (!state.isWrongBookMode) return ok();
    const snap = state.wrongBookSnapshot || {};
    setState({
        isWrongBookMode: false,
        category: snap.category ?? 'all',
        mode: snap.mode ?? 'sequential',
        statusFilter: snap.statusFilter ?? 'all',
        lastIndex: snap.index ?? 0,
        wrongBookSnapshot: null,
    });
    bus.emit(Events.WRONGBOOK_EXITED, {});
    bus.emit(Events.NAVIGATION_CHANGED, { source: 'wrongbook-exit' });
    return ok();
}

/**
 * 标记题目掌握（移出错题本）
 * @param {Question|string|number} qIdOrQuestion
 * @returns {Result<{ remaining: number; cleared: boolean }>}
 */
export function markMastered(qIdOrQuestion) {
    const state = getState();
    if (!state.isWrongBookMode) {
        return err(ErrorCode.NOT_IN_WRONG_BOOK, '不在错题专注模式');
    }
    // 传入完整 questions 列表，确保 ProgressAPI 增量统计准确（同 bug B 修复）
    const libsR = storage.getLibraries();
    const lib = libsR.ok ? libsR.data[state.currentLibId] : null;
    const fullQuestions = lib?.questions || [];
    const r = ProgressAPI.setStatus(qIdOrQuestion, 'mastered', {
        libId: state.currentLibId,
        source: 'wrong-book',
        questions: fullQuestions,
    });
    if (!r.ok) return r;

    // 重新计算错题数（ProgressAPI 缓存已更新）
    const remainingR = count();
    const remaining = remainingR.ok ? remainingR.data : 0;

    if (remaining === 0) {
        bus.emit(Events.WRONGBOOK_CLEARED, { libId: state.currentLibId });
        // 自动退出
        exit();
        bus.emit(Events.WRONGBOOK_MARKED, { remaining: 0, cleared: true });
        return ok({ remaining: 0, cleared: true });
    }
    bus.emit(Events.NAVIGATION_CHANGED, { source: 'wrongbook-mark' });
    bus.emit(Events.WRONGBOOK_MARKED, { remaining, cleared: false });
    return ok({ remaining, cleared: false });
}

export const WrongBookAPI = {
    enter,
    exit,
    list,
    count,
    markMastered,
};
