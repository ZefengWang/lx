/**
 * QuestionAPI - 题目管理 + 答题判分
 * 判分逻辑从 app.js L442-L533 click handler 迁移
 * @module api/question
 */

import * as storage from '../core/storage.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { getState } from '../core/state.js';
import { normalizeQuestion } from '../core/validators/question.js';
import * as ProgressAPI from './progress.js';

/**
 * 计算字符串 bigram 字符相似度（Sørensen-Dice）
 * - 适配中英文：把非空字符串按相邻 2 字符切成 shingle 集合
 * - 返回 [0, 1]，值越高越相似；任一为空返回 0
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarity(a, b) {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (sa === sb) return 1;
    if (sa.length < 2 || sb.length < 2) {
        // 退化成单字符 Jaccard
        const ca = new Set(sa);
        const cb = new Set(sb);
        if (ca.size === 0 && cb.size === 0) return 1;
        let inter = 0;
        for (const ch of ca) if (cb.has(ch)) inter++;
        return inter / (ca.size + cb.size - inter);
    }
    /** @param {string} s @returns {Map<string, number>} */
    const gram = (s) => {
        const m = new Map();
        for (let i = 0; i + 1 < s.length; i++) {
            const g = s.slice(i, i + 2);
            m.set(g, (m.get(g) || 0) + 1);
        }
        return m;
    };
    const ga = gram(sa);
    const gb = gram(sb);
    let inter = 0;
    for (const [g, count] of ga) {
        const c2 = gb.get(g) || 0;
        inter += Math.min(count, c2);
    }
    const sumA = Array.from(ga.values()).reduce((x, y) => x + y, 0);
    const sumB = Array.from(gb.values()).reduce((x, y) => x + y, 0);
    return (2 * inter) / (sumA + sumB || 1);
}

/**
 * 列出当前题库的题目（支持筛选）
 * @param {{ category?: string; status?: QuestionStatus; mode?: string }} [filter]
 * @returns {Result<{ questions: Question[]; total: number }>}
 */
export function list(filter = {}) {
    const libId = getState().currentLibId;
    if (!libId) return ok({ questions: [], total: 0 });
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');
    let questions = lib.questions || [];

    if (filter.category && filter.category !== 'all') {
        questions = questions.filter((q) => (q.category || '未分类') === filter.category);
    }
    if (filter.status && filter.status !== 'all') {
        questions = questions.filter((q) => ProgressAPI.getStatus(q).data === filter.status);
    }
    return ok({ questions: [...questions], total: questions.length });
}

/**
 * 获取单题（按 uid 或 id）
 * @param {string|number} qId
 * @returns {Result<Question>}
 */
export function get(qId) {
    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');
    const found = (lib.questions || []).find((q) => (q.uid != null ? String(q.uid) : String(q.id)) === String(qId));
    if (!found) return err(ErrorCode.NOT_FOUND, '题目不存在');
    return ok({ ...found });
}

/**
 * 添加题目
 * @param {Partial<Question> & { question: string }} partial
 * @returns {Result<{ id: number; question: Question }>}
 */
export function add(partial) {
    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');
    if (!partial || !partial.question) {
        return err(ErrorCode.INVALID_INPUT, '题目内容不能为空');
    }
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');

    const questions = lib.questions || [];
    const maxUid = questions.reduce((m, q) => Math.max(m, q.uid || 0), 0);
    const maxId = questions.reduce((m, q) => Math.max(m, Number(q.id) || 0), 0);

    const nq = normalizeQuestion(partial, maxUid + 1);
    nq.uid = maxUid + 1;
    if (nq.id == null || nq.id === 0) nq.id = maxId + 1;
    if (nq.displayId == null) nq.displayId = nq.id;

    questions.push(nq);
    lib.questions = questions;
    const libs = r.data;
    libs[libId] = lib;
    const saveR = storage.setLibraries(libs);
    if (!saveR.ok) return saveR;

    bus.emit(Events.QUESTION_ADDED, { libId, qId: nq.uid });
    return ok({ id: nq.uid, question: nq });
}

/**
 * 更新题目字段（仅允许更新特定字段）
 */
export function update(qId, patch) {
    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');

    const idx = (lib.questions || []).findIndex(
        (q) => (q.uid != null ? String(q.uid) : String(q.id)) === String(qId)
    );
    if (idx === -1) return err(ErrorCode.NOT_FOUND, '题目不存在');

    const allowed = ['answerText', 'remarks', 'explanation', 'mnemonic', 'options', 'answer', 'question', 'type', 'category'];
    const updated = { ...lib.questions[idx] };
    for (const k of allowed) {
        if (k in patch) updated[k] = patch[k];
    }
    // explanation 与 mnemonic 同步
    if ('explanation' in patch && !('mnemonic' in patch)) updated.mnemonic = updated.explanation;
    if ('mnemonic' in patch && !('explanation' in patch)) updated.explanation = updated.mnemonic;

    lib.questions[idx] = updated;
    const libs = r.data;
    libs[libId] = lib;
    const saveR = storage.setLibraries(libs);
    if (!saveR.ok) return saveR;

    bus.emit(Events.QUESTION_UPDATED, { libId, qId, patch });
    return ok();
}

/**
 * 删除题目
 */
export function remove(qId) {
    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');
    const r = storage.getLibraries();
    if (!r.ok) return r;
    const lib = r.data[libId];
    if (!lib) return err(ErrorCode.NOT_FOUND, '题库不存在');

    const idx = (lib.questions || []).findIndex(
        (q) => (q.uid != null ? String(q.uid) : String(q.id)) === String(qId)
    );
    if (idx === -1) return err(ErrorCode.NOT_FOUND, '题目不存在');

    lib.questions.splice(idx, 1);
    const libs = r.data;
    libs[libId] = lib;
    const saveR = storage.setLibraries(libs);
    if (!saveR.ok) return saveR;

    bus.emit(Events.QUESTION_DELETED, { libId, qId });
    return ok();
}

/**
 * 答题判分（核心）
 * @param {Question|string|number} qIdOrQuestion - 题目对象（推荐）或题目 ID
 * @param {string|string[]} userAnswer - 用户答案（multi 为字符串数组）
 * @returns {Result<AnswerResult>}
 */
export function answer(qIdOrQuestion, userAnswer) {
    const libId = getState().currentLibId;
    if (!libId) return err(ErrorCode.STATE_ERROR, '未选择题库');

    let question;
    if (qIdOrQuestion && typeof qIdOrQuestion === 'object') {
        question = qIdOrQuestion;
    } else {
        const r = get(qIdOrQuestion);
        if (!r.ok) return r;
        question = r.data;
    }

    const type = question.type || 'essay';
    const correctAnswer = question.answer || '';
    const essayRef = (question.answerText || '').trim();
    let correct = false;
    let notGraded = false; // essay 未设置答案 → 不判分，不打掌握/错题

    if (type === 'single') {
        correct = String(userAnswer || '').trim().toUpperCase() === String(correctAnswer).trim().toUpperCase();
    } else if (type === 'multi') {
        const userArr = Array.isArray(userAnswer)
            ? userAnswer.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
            : String(userAnswer || '')
                  .split(/[,，;；]/)
                  .map((x) => x.trim().toUpperCase())
                  .filter(Boolean);
        const correctArr = String(correctAnswer)
            .split(/[,，;；]/)
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean);
        correct =
            userArr.length === correctArr.length &&
            userArr.every((x) => correctArr.includes(x));
    } else if (type === 'judge') {
        correct = String(userAnswer || '').trim() === String(correctAnswer).trim();
    } else if (type === 'fill') {
        correct =
            String(userAnswer || '').trim().toLowerCase() ===
            String(correctAnswer).trim().toLowerCase();
    } else {
        // essay 判分规则（与用户要求一致）：
        //   - 有 answerText → 用中文 bigram 字符相似度判分（阈值 0.5，简单但避免完全相同才判对的苛刻）
        //   - 无 answerText → 不判分（notGraded=true，后续不设置 master/review 自动状态）
        const ua = String(userAnswer || '').trim();
        if (!essayRef) {
            notGraded = true;
            correct = false;
        } else {
            const sim = similarity(ua, essayRef);
            correct = sim >= 0.5;
        }
    }

    const autoStatus = correct ? 'mastered' : 'review';
    const shouldSetStatus = !(type === 'essay' && notGraded);

    // 触发事件 + 自动更新进度
    bus.emit(Events.QUESTION_ANSWERED, {
        libId,
        qId: question.uid ?? question.id,
        correct,
        notGraded,
        userAnswer,
        correctAnswer: type === 'essay' ? essayRef : correctAnswer,
        type,
    });

    // 自动设置进度（错题模式下不在此处自动设置，由 WrongBookAPI.markMastered 控制）
    // 注意：essay 且 notGraded=true 时不自动改状态（用户未设参考答案，不能凭啥打对错）
    if (!getState().isWrongBookMode && shouldSetStatus) {
        const libsR = storage.getLibraries();
        const lib = libsR.ok ? libsR.data[libId] : null;
        const fullQuestions = lib?.questions || [];
        const setStatusR = ProgressAPI.setStatus(question, autoStatus, {
            libId,
            source: 'answer',
            questions: fullQuestions,
        });
        if (!setStatusR.ok) return setStatusR;
    }

    return ok({
        correct,
        notGraded: Boolean(notGraded),
        similarity: type === 'essay' && essayRef ? similarity(String(userAnswer || '').trim(), essayRef) : undefined,
        correctAnswer: type === 'essay' ? essayRef : correctAnswer,
        explanation: question.explanation || '',
        autoStatus: shouldSetStatus ? autoStatus : null,
    });
}

/**
 * 重置题目的答题状态（仅 UI 层用，不影响 progress）
 */
export function resetAttempt(qId) {
    const libId = getState().currentLibId;
    bus.emit(Events.QUESTION_UPDATED, { libId, qId, patch: { _resetAttempt: true } });
    return ok();
}

export const QuestionAPI = {
    list,
    get,
    add,
    update,
    delete: remove,
    answer,
    resetAttempt,
};
