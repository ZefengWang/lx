/**
 * CategoryAPI - 分类管理
 * 从 app.js L862-L959 迁移
 * @module api/category
 */

import * as storage from '../core/storage.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { getState } from '../core/state.js';

/**
 * 列出当前题库的所有分类（含题目数）
 * @returns {{ok: true, data: Array<{name, count}>}}
 */
export function list() {
    const libId = getState().currentLibId;
    if (!libId) return ok([]);

    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return ok([]);

    const counts = {};
    for (const q of lib.questions || []) {
        const cat = q.category || '未分类';
        counts[cat] = (counts[cat] || 0) + 1;
    }
    return ok(
        Object.entries(counts).map(([name, count]) => ({ name, count }))
    );
}

/**
 * 重命名分类（支持合并：若 newName 已存在则合并题目数）
 * @param {string} oldName
 * @param {string} newName
 */
export function rename(oldName, newName) {
    if (!oldName || !newName) {
        return err(ErrorCode.INVALID_INPUT, '分类名不能为空');
    }
    if (oldName === newName) return ok();

    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');

    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');

    let changedCount = 0;
    const questions = lib.questions.map((q) => {
        if ((q.category || '未分类') === oldName) {
            changedCount++;
            return { ...q, category: newName };
        }
        return q;
    });

    if (changedCount === 0) {
        return err(ErrorCode.NOT_FOUND, `分类 "${oldName}" 不存在`);
    }

    lib.questions = questions;
    const libs = r.data;
    libs[libId] = lib;
    const saveR = storage.setLibraries(libs);
    if (!saveR.ok) return saveR;

    bus.emit(Events.CATEGORY_RENAMED, { libId, oldName, newName, changedCount });
    return ok({ changedCount });
}

export const CategoryAPI = {
    list,
    rename,
};
