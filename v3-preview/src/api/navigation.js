/**
 * NavigationAPI - 题目导航
 * 操作 state.filteredQIds 与 state.lastIndex，循环边界处理
 * @module api/navigation
 */

import { getState, setState } from '../core/state.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { shuffleArray } from '../utils.js';
import * as LibraryAPI from './library.js';
import * as ProgressAPI from './progress.js';

/**
 * 实时计算当前可见题目 ID 列表
 * - 错题模式：仅 review 题
 * - 常规模式：按 category + statusFilter 筛选
 * - 随机模式：洗牌
 */
function computeFilteredQIds() {
    const state = getState();
    if (!state.currentLibId) return [];
    const r = LibraryAPI.get(state.currentLibId);
    if (!r.ok) return [];
    let questions = r.data.questions || [];

    if (state.isWrongBookMode) {
        questions = questions.filter((q) => ProgressAPI.getStatus(q).data === 'review');
    } else {
        if (state.category && state.category !== 'all') {
            questions = questions.filter((q) => (q.category || '未分类') === state.category);
        }
        if (state.statusFilter && state.statusFilter !== 'all') {
            questions = questions.filter((q) => ProgressAPI.getStatus(q).data === state.statusFilter);
        }
    }

    let ids = questions.map((q) => (q.uid != null ? q.uid : q.id));
    if (state.mode === 'random') {
        ids = shuffleArray(ids);
    }
    return ids;
}

/**
 * 获取当前题目的位置信息
 * @returns {{ok: true, data: {index, qId, total}}}
 */
export function current() {
    const state = getState();
    const ids = computeFilteredQIds();
    if (ids.length === 0) {
        if (state.filteredQIds.length > 0) setState({ filteredQIds: [], lastIndex: 0 });
        return ok({ index: 0, qId: null, total: 0 });
    }
    const safeIndex = Math.min(state.lastIndex, ids.length - 1);
    const qId = ids[safeIndex];
    // 同步 state（避免无意义 setState 导致订阅者循环刷新）
    // 用长度+末位元素+lastIndex 比较代替数组引用比较（computeFilteredQIds 每次返回新数组）
    const prev = state.filteredQIds;
    const sameFiltered =
        prev.length === ids.length &&
        (prev.length === 0 || prev[prev.length - 1] === ids[ids.length - 1]);
    if (!sameFiltered || state.lastIndex !== safeIndex) {
        setState({ filteredQIds: ids, lastIndex: safeIndex, lastQId: qId });
    }
    return ok({ index: safeIndex, qId, total: ids.length });
}

/**
 * 跳转到指定索引
 */
export function goto(index) {
    const ids = computeFilteredQIds();
    if (ids.length === 0) {
        return err(ErrorCode.OUT_OF_RANGE, '无题目可导航');
    }
    if (index < 0 || index >= ids.length) {
        return err(ErrorCode.OUT_OF_RANGE, `索引 ${index} 超出范围 [0, ${ids.length - 1}]`);
    }
    setState({ filteredQIds: ids, lastIndex: index, lastQId: ids[index] });
    bus.emit(Events.NAVIGATION_CHANGED, { index, qId: ids[index], total: ids.length, source: 'api' });
    return ok({ index, qId: ids[index], total: ids.length });
}

/**
 * 下一题（循环）
 */
export function next() {
    const state = getState();
    const ids = computeFilteredQIds();
    if (ids.length === 0) return err(ErrorCode.OUT_OF_RANGE, '无题目可导航');
    let nextIndex = state.lastIndex + 1;
    if (nextIndex >= ids.length) nextIndex = 0;
    return goto(nextIndex);
}

/**
 * 上一题（循环）
 */
export function prev() {
    const state = getState();
    const ids = computeFilteredQIds();
    if (ids.length === 0) return err(ErrorCode.OUT_OF_RANGE, '无题目可导航');
    let prevIndex = state.lastIndex - 1;
    if (prevIndex < 0) prevIndex = ids.length - 1;
    return goto(prevIndex);
}

/**
 * 随机跳转
 */
export function random() {
    const ids = computeFilteredQIds();
    if (ids.length === 0) return err(ErrorCode.OUT_OF_RANGE, '无题目可导航');
    const index = Math.floor(Math.random() * ids.length);
    return goto(index);
}

/**
 * 设置浏览模式
 *
 * ## 随机模式下的"上一题 / 下一题"语义说明
 * 随机模式在进入时会**一次性洗牌**，得到一个固定的「浏览序列」——
 * 此后 prev / next 只是在这个洗牌序列里前后移动（循环）：
 *   - 用户进入时看到的「第一题」是序列 [0] 位置的题（题目本身是随机的，并不一定是库中 id=1 的题）
 *   - 再按"下一题"前进到序列 [1]，再到 [2] …
 *   - 按"上一题"回退到序列 [index-1]；当 index=0 时循环回序列末尾
 *
 * 这样设计的原因（避免常见的语义错误）：
 *   - ✗ 不做："按物理 id / 原始顺序后退"——进入随机模式后，用户不应再感知原始顺序
 *   - ✗ 不做：每按一次"下一题"都重新随机（不生成序列）—— 会导致无法回退，且可能重复遇到刚做过的题
 *   - ✓ 做：一次性洗牌，序列在本次会话内固定，prev/next 就沿序列线性移动（循环），体验可预测
 *
 * @param {'sequential'|'random'} mode
 */
export function setMode(mode) {
    if (!['sequential', 'random'].includes(mode)) {
        return err(ErrorCode.INVALID_INPUT, '模式无效：' + mode);
    }
    setState({ mode });
    const ids = computeFilteredQIds();
    // 进入新模式一律回到序列起点（用户期望"切换模式后重新开始"）
    setState({ filteredQIds: ids, lastIndex: 0, lastQId: ids[0] ?? null });
    bus.emit(Events.NAVIGATION_CHANGED, { index: 0, qId: ids[0] ?? null, total: ids.length, source: 'mode-change', mode });
    return ok({ mode });
}

/**
 * 洗牌（仅随机模式）—— 重新抽取一个浏览序列并从 [0] 开始
 * 注意：每次 shuffle 后会重置浏览位置，上一题/下一题在新序列上移动
 */
export function shuffle() {
    const state = getState();
    if (state.mode !== 'random') {
        return err(ErrorCode.STATE_ERROR, '非随机模式不支持洗牌，请先切换到随机模式');
    }
    const ids = computeFilteredQIds();
    setState({ filteredQIds: ids, lastIndex: 0, lastQId: ids[0] ?? null });
    bus.emit(Events.NAVIGATION_CHANGED, { index: 0, qId: ids[0] ?? null, total: ids.length, source: 'shuffle' });
    return ok({ total: ids.length });
}

/**
 * 设置分类筛选
 */
export function setCategory(category) {
    setState({ category: category || 'all' });
    const ids = computeFilteredQIds();
    setState({ filteredQIds: ids, lastIndex: 0, lastQId: ids[0] ?? null });
    bus.emit(Events.NAVIGATION_CHANGED, { index: 0, qId: ids[0] ?? null, total: ids.length, source: 'category-change' });
    return ok();
}

/**
 * 设置状态筛选
 */
export function setStatusFilter(statusFilter) {
    setState({ statusFilter: statusFilter || 'all' });
    const ids = computeFilteredQIds();
    setState({ filteredQIds: ids, lastIndex: 0, lastQId: ids[0] ?? null });
    bus.emit(Events.NAVIGATION_CHANGED, { index: 0, qId: ids[0] ?? null, total: ids.length, source: 'status-change' });
    return ok();
}

/**
 * 读取当前浏览模式（供 UI 显示按钮态）
 * @returns {'sequential'|'random'}
 */
export function getMode() {
    return getState().mode || 'sequential';
}

/**
 * 读取当前分类筛选
 * @returns {string} 分类名或 'all'
 */
export function getCategory() {
    return getState().category || 'all';
}

/**
 * 读取当前状态筛选
 * @returns {string}
 */
export function getStatusFilter() {
    return getState().statusFilter || 'all';
}

/**
 * 列出当前题库的所有分类（去重，保持出现顺序）
 * 用于 UI 的分类选择器
 * @returns {{ok: true, data: string[]}}
 */
export function listCategories() {
    const state = getState();
    if (!state.currentLibId) return ok([]);
    const r = LibraryAPI.get(state.currentLibId);
    if (!r.ok) return ok([]);
    const questions = r.data.questions || [];
    const seen = new Set();
    const cats = [];
    for (const q of questions) {
        const c = q.category || '未分类';
        if (!seen.has(c)) { seen.add(c); cats.push(c); }
    }
    return ok(cats);
}

export const NavigationAPI = {
    current,
    goto,
    next,
    prev,
    random,
    setMode,
    shuffle,
    setCategory,
    setStatusFilter,
    getMode,
    getCategory,
    getStatusFilter,
    listCategories,
};
