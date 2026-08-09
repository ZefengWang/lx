/**
 * StatsAPI - 统计查询
 * 复用 ProgressAPI 的缓存，避免重复计算
 * @module api/stats
 */

import { ok, err, ErrorCode } from '../core/errors.js';
import { getState } from '../core/state.js';
import * as storage from '../core/storage.js';
import * as ProgressAPI from './progress.js';

/**
 * 当前题库完整统计
 * @returns {{ok: true, data: {total, mastered, review, percent, byCategory, byType}}}
 */
export function summary() {
    const libId = getState().currentLibId;
    if (!libId) {
        return ok({ total: 0, mastered: 0, review: 0, percent: 0, byCategory: {}, byType: {} });
    }
    const libR = storage.getLibraries();
    if (!libR.ok) return libR;
    const lib = libR.data[libId];
    const questions = lib?.questions || [];

    const statsR = ProgressAPI.stats(libId, questions);
    const s = statsR.ok ? statsR.data : { total: 0, mastered: 0, review: 0, percent: 0 };

    const byCategory = {};
    const byType = { single: makeTypeStat(), multi: makeTypeStat(), judge: makeTypeStat(), fill: makeTypeStat(), essay: makeTypeStat() };
    const progressMap = ProgressAPI._getProgressMap();
    const libProgress = (progressMap && progressMap[libId]) || {};

    for (const q of questions) {
        const key = q.uid != null ? String(q.uid) : String(q.id);
        const status = (key && libProgress[key]) || 'none';
        const cat = q.category || '未分类';
        if (!byCategory[cat]) byCategory[cat] = makeTypeStat();
        byCategory[cat].total++;
        if (status === 'mastered') byCategory[cat].mastered++;
        else if (status === 'review') byCategory[cat].review++;

        const t = q.type in byType ? q.type : 'essay';
        byType[t].total++;
        if (status === 'mastered') byType[t].mastered++;
        else if (status === 'review') byType[t].review++;
    }
    return ok({
        total: s.total,
        mastered: s.mastered,
        review: s.review,
        percent: s.percent,
        byCategory,
        byType,
    });
}

/**
 * 按分类统计
 */
export function byCategory() {
    const r = summary();
    if (!r.ok) return r;
    return ok(
        Object.entries(r.data.byCategory).map(([category, s]) => ({
            category,
            total: s.total,
            mastered: s.mastered,
            review: s.review,
        }))
    );
}

/**
 * 按题型统计
 */
export function byType() {
    const r = summary();
    if (!r.ok) return r;
    return ok(r.data.byType);
}

function makeTypeStat() {
    return { total: 0, mastered: 0, review: 0 };
}

export const StatsAPI = {
    summary,
    byCategory,
    byType,
};
