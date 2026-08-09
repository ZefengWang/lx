/**
 * LibraryAPI - 题库管理
 * 修复 bug 6：不再 q.id = q.uid 覆盖；保留原始 id，新增 uid 作内部稳定标识
 * 含指纹去重检测
 * @module api/library
 */

import * as storage from '../core/storage.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { genLibId } from '../core/id.js';
import { getState, setState } from '../core/state.js';
import { normalizeQuestion } from '../core/validators/question.js';
import { hashString, deepClone } from '../utils.js';
import * as ProgressAPI from './progress.js';

/**
 * 列出所有题库（含统计摘要）
 * @returns {Result<LibrarySummary[]>}
 */
export function list() {
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const libs = r.data || {};
    const result = [];
    for (const id of Object.keys(libs)) {
        const lib = libs[id];
        const questions = lib.questions || [];
        const statsR = ProgressAPI.stats(id, questions);
        const s = statsR.ok ? statsR.data : { mastered: 0, review: 0, percent: 0 };
        result.push({
            id,
            name: lib.name || '未命名题库',
            questionCount: questions.length,
            masteredCount: s.mastered,
            reviewCount: s.review,
            percent: s.percent,
        });
    }
    return ok(result);
}

/**
 * 获取当前题库 ID
 */
export function current() {
    return ok(getState().currentLibId);
}

/**
 * 获取题库详情
 * @param {string} libId
 * @returns {Result<Library>}
 */
export function get(libId) {
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const libs = r.data || {};
    const lib = libs[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');
    return ok(deepClone(lib));
}

/**
 * 题库指纹：基于 question + type + answer 的哈希
 * 忽略 remarks/answerText 等可变字段
 */
function fingerprint(questions) {
    const sig = questions
        .map((q) => `${q.question || ''}::${q.type || ''}::${q.answer || ''}`)
        .sort()
        .join('||');
    return hashString(sig);
}

/**
 * 查找内容匹配的已有题库
 * @returns {{matchingLibId: string | null}}
 */
export function findMatchingLibrary(questions) {
    const r = storage.getLibraries();
    if (!r.ok) return { matchingLibId: null };
    const libs = r.data || {};
    const targetFp = fingerprint(questions);
    for (const id of Object.keys(libs)) {
        if (fingerprint(libs[id].questions || []) === targetFp) {
            return { matchingLibId: id };
        }
    }
    return { matchingLibId: null };
}

/**
 * 创建题库
 * @param {string} name
 * @param {Partial<Question>[]} questions - raw 题目数组（未归一化）
 * @param {{ skipDuplicateCheck?: boolean }} [options]
 * @returns {Result<{ id: string }>}
 */
export function create(name, questions, options = {}) {
    if (!name || !name.trim()) {
        return err(ErrorCode.INVALID_INPUT, '题库名不能为空');
    }
    if (!Array.isArray(questions)) {
        return err(ErrorCode.INVALID_INPUT, '题目列表必须是数组');
    }

    // 去重检测
    if (!options.skipDuplicateCheck && questions.length > 0) {
        const { matchingLibId } = findMatchingLibrary(questions);
        if (matchingLibId) {
            return err(ErrorCode.DUPLICATE, '检测到内容相同的题库', { matchingLibId });
        }
    }

    // 归一化题目 + 分配 uid（修复 bug 6）
    const normalized = questions.map((q, idx) => {
        const nq = normalizeQuestion(q, idx + 1);
        nq.uid = idx + 1; // 内部稳定标识
        if (nq.displayId == null) nq.displayId = nq.id;
        return nq;
    });

    const id = genLibId();
    const libs = storage.getLibraries().data || {};
    libs[id] = {
        id,
        name: name.trim(),
        questions: normalized,
        createdAt: new Date().toISOString(),
    };

    const r = storage.setLibraries(libs);
    if (!r.ok) return r;

    bus.emit(Events.LIBRARY_CREATED, { id, name: name.trim(), questionCount: normalized.length });
    return ok({ id });
}

/**
 * 切换当前题库
 */
export function switchLib(libId) {
    const libs = storage.getLibraries();
    if (!libs.ok) return libs;
    if (!libs.data[libId]) {
        return err(ErrorCode.NOT_FOUND, '题库不存在');
    }
    setState({
        currentLibId: libId,
        lastIndex: 0,
        lastQId: null,
        category: 'all',
        statusFilter: 'all',
        mode: 'sequential',
        isWrongBookMode: false,
        wrongBookSnapshot: null,
        filteredQIds: [],
        uiVisibility: { mnemonic: false, answer: false, remark: false },
    });
    storage.setLastLibraryId(libId);
    ProgressAPI.invalidateCache();
    bus.emit(Events.LIBRARY_SWITCHED, { libId, libName: libs.data[libId].name });
    return ok();
}

/**
 * 删除题库（同步删除其进度）
 */
export function remove(libId) {
    const libs = storage.getLibraries();
    if (!libs.ok) return libs;
    if (!libs.data[libId]) {
        return err(ErrorCode.NOT_FOUND, '题库不存在');
    }
    const libName = libs.data[libId].name;
    delete libs.data[libId];
    const r = storage.setLibraries(libs.data);
    if (!r.ok) return r;
    ProgressAPI.removeLibraryProgress(libId);

    // 若删除的是当前题库，清空当前状态
    if (getState().currentLibId === libId) {
        setState({
            currentLibId: null,
            lastIndex: 0,
            lastQId: null,
            filteredQIds: [],
            isWrongBookMode: false,
            wrongBookSnapshot: null,
        });
        storage.setLastLibraryId(null);
    }
    bus.emit(Events.LIBRARY_DELETED, { libId, libName });
    return ok();
}

/**
 * 重命名题库
 */
export function rename(libId, newName) {
    if (!newName || !newName.trim()) {
        return err(ErrorCode.INVALID_INPUT, '题库名不能为空');
    }
    const libs = storage.getLibraries();
    if (!libs.ok) return libs;
    if (!libs.data[libId]) {
        return err(ErrorCode.NOT_FOUND, '题库不存在');
    }
    libs.data[libId].name = newName.trim();
    const r = storage.setLibraries(libs.data);
    if (!r.ok) return r;
    bus.emit(Events.LIBRARY_RENAMED, { libId, name: newName.trim() });
    return ok({ name: newName.trim() });
}

/**
 * 获取当前题库的题目数组（便捷方法）
 * @returns {Result<Question[]>}
 */
export function currentQuestions() {
    const libId = getState().currentLibId;
    if (!libId) return ok([]);
    const r = get(libId);
    if (!r.ok) return r;
    return ok(r.data.questions || []);
}

export const LibraryAPI = {
    list,
    get,
    current,
    create,
    switch: switchLib,
    delete: remove,
    rename,
    findMatchingLibrary,
    currentQuestions,
};
