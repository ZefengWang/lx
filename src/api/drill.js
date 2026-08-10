/**
 * DrillAPI — 快速刷题 / 背诵记忆会话
 * 固定本轮队列；优先未标记（none）；prev/next 支持回看
 * @module api/drill
 */

import { getState, setState } from '../core/state.js';
import { bus, Events } from '../core/events.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { shuffleArray } from '../utils.js';
import * as LibraryAPI from './library.js';
import * as ProgressAPI from './progress.js';
import * as WrongBookAPI from './wrong-book.js';

const DEFAULT_COUNT = 100;

/** @type {ReturnType<typeof setTimeout>|null} */
let _scheduledAdvance = null;

/** 取消 UI 层安排的答后自动推进（切题/离页时调用） */
export function cancelScheduledAdvance() {
    if (_scheduledAdvance != null) {
        clearTimeout(_scheduledAdvance);
        _scheduledAdvance = null;
    }
}

/**
 * @param {number} delayMs
 * @param {() => void} fn
 */
export function scheduleAdvance(delayMs, fn) {
    cancelScheduledAdvance();
    const ms = Math.max(0, Number(delayMs) || 0);
    if (ms <= 0) {
        fn();
        return;
    }
    _scheduledAdvance = setTimeout(() => {
        _scheduledAdvance = null;
        fn();
    }, ms);
}

/**
 * @returns {boolean}
 */
export function isActive() {
    const s = getState().drillSession;
    return !!(s && Array.isArray(s.queue) && s.queue.length);
}

/**
 * @returns {Result<object|null>}
 */
export function current() {
    const s = getState().drillSession;
    if (!s || !s.queue?.length) return ok(null);
    const qId = s.queue[s.viewIndex] ?? null;
    const answer = qId != null ? (s.answers[String(qId)] || null) : null;
    return ok({
        mode: s.mode,
        queue: s.queue.slice(),
        progressIndex: s.progressIndex,
        viewIndex: s.viewIndex,
        total: s.queue.length,
        qId,
        answer,
        done: s.progressIndex >= s.queue.length,
        viewingHistory: s.viewIndex < s.progressIndex,
    });
}

/**
 * 构建优先未标记的队列
 * @param {object[]} questions
 * @param {number} count
 * @returns {(string|number)[]}
 */
export function buildPreferNoneQueue(questions, count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n === 0 || !questions?.length) return [];
    const unmarked = [];
    const marked = [];
    for (const q of questions) {
        const id = q.uid != null ? q.uid : q.id;
        if (ProgressAPI.getStatus(q).data === 'none') unmarked.push(id);
        else marked.push(id);
    }
    const u = shuffleArray(unmarked);
    const m = shuffleArray(marked);
    return u.concat(m).slice(0, Math.min(n, u.length + m.length));
}

function syncNavFromSession(session, source) {
    const qId = session.queue[session.viewIndex] ?? null;
    setState({
        drillSession: session,
        filteredQIds: session.queue.slice(),
        lastIndex: session.viewIndex,
        lastQId: qId,
        mode: 'sequential',
        statusFilter: 'all',
    });
    bus.emit(Events.NAVIGATION_CHANGED, {
        index: session.viewIndex,
        qId,
        total: session.queue.length,
        source: source || 'drill',
    });
}

/**
 * 开始会话
 * @param {{ mode: 'quick'|'memory', count?: number, category?: string }} opts
 */
export function start(opts = {}) {
    cancelScheduledAdvance();
    const mode = opts.mode === 'memory' ? 'memory' : 'quick';

    const state = getState();
    if (!state.currentLibId) {
        return err(ErrorCode.STATE_ERROR, '未选择题库');
    }

    if (state.isWrongBookMode) {
        WrongBookAPI.exit();
    }
    // 练习会话与搜索队列互斥
    if (state.searchPlaylist) {
        setState({ searchPlaylist: null });
    }

    const libR = LibraryAPI.get(state.currentLibId);
    if (!libR.ok) return libR;
    let questions = libR.data.questions || [];
    const category = opts.category != null ? opts.category : state.category;
    if (category && category !== 'all') {
        questions = questions.filter((q) => (q.category || '未分类') === category);
    }
    if (!questions.length) {
        return err(ErrorCode.OUT_OF_RANGE, '没有可练习的题目');
    }

    // 背诵：未显式传 count → 全量；快速：默认 DEFAULT_COUNT
    let count;
    if (opts.count == null) {
        count = mode === 'memory' ? questions.length : DEFAULT_COUNT;
    } else {
        count = Math.floor(Number(opts.count));
    }
    if (!Number.isFinite(count) || count < 1) {
        return err(ErrorCode.INVALID_INPUT, '题目数量无效');
    }

    count = Math.min(count, questions.length);
    const queue = buildPreferNoneQueue(questions, count);
    if (!queue.length) {
        return err(ErrorCode.OUT_OF_RANGE, '没有可练习的题目');
    }

    const session = {
        mode,
        queue,
        progressIndex: 0,
        viewIndex: 0,
        answers: {},
    };
    syncNavFromSession(session, 'drill-start');
    return ok({
        mode,
        total: queue.length,
        qId: queue[0],
        index: 0,
    });
}

/**
 * 结束会话
 */
export function exit() {
    cancelScheduledAdvance();
    if (!getState().drillSession) return ok();
    setState({ drillSession: null });
    bus.emit(Events.NAVIGATION_CHANGED, { source: 'drill-exit' });
    return ok();
}

/**
 * 记录作答（回看用）
 * @param {string|number} qId
 * @param {{ userAnswer: any, correct: boolean, correctAnswer?: any, notGraded?: boolean }} payload
 */
export function recordAnswer(qId, payload = {}) {
    const state = getState();
    const s = state.drillSession;
    if (!s) return err(ErrorCode.STATE_ERROR, '未在练习会话中');
    const answers = { ...s.answers };
    answers[String(qId)] = {
        userAnswer: payload.userAnswer,
        correct: !!payload.correct,
        correctAnswer: payload.correctAnswer,
        notGraded: !!payload.notGraded,
    };
    const session = { ...s, answers };
    setState({ drillSession: session });
    return ok({ recorded: true });
}

/**
 * 答后推进（仅快速模式由 UI 调用；背诵不调用）
 * @param {{ correct: boolean }} result
 * @returns {Result<{ advanced: boolean, done: boolean, delayMs: number }>}
 */
export function afterAnswer(result = {}) {
    const s = getState().drillSession;
    if (!s) return err(ErrorCode.STATE_ERROR, '未在练习会话中');
    if (s.mode !== 'quick') {
        return ok({ advanced: false, done: false, delayMs: 0 });
    }
    // 仅在进度题上作答才推进
    if (s.viewIndex !== s.progressIndex) {
        return ok({ advanced: false, done: false, delayMs: 0 });
    }
    const correct = !!result.correct;
    const delayMs = correct ? 0 : 5000;
    return ok({ advanced: true, done: false, delayMs, correct });
}

/**
 * 推进到下一进度题（答对立即 / 答错延时后 / 背诵用户点下一题）
 */
export function advanceProgress() {
    const s = getState().drillSession;
    if (!s) return err(ErrorCode.STATE_ERROR, '未在练习会话中');
    if (s.progressIndex >= s.queue.length - 1) {
        const session = {
            ...s,
            progressIndex: s.queue.length,
            viewIndex: s.queue.length - 1,
        };
        syncNavFromSession(session, 'drill-done');
        return ok({ done: true, index: session.viewIndex, total: s.queue.length });
    }
    const nextIdx = s.progressIndex + 1;
    const session = {
        ...s,
        progressIndex: nextIdx,
        viewIndex: nextIdx,
    };
    syncNavFromSession(session, 'drill-advance');
    return ok({ done: false, index: nextIdx, total: s.queue.length, qId: s.queue[nextIdx] });
}

/**
 * 上一题：回看已访问题目
 */
export function prev() {
    cancelScheduledAdvance();
    const s = getState().drillSession;
    if (!s) return err(ErrorCode.STATE_ERROR, '未在练习会话中');
    if (s.viewIndex <= 0) {
        return ok({ index: 0, qId: s.queue[0], total: s.queue.length, atStart: true });
    }
    const viewIndex = s.viewIndex - 1;
    const session = { ...s, viewIndex };
    syncNavFromSession(session, 'drill-prev');
    return ok({
        index: viewIndex,
        qId: s.queue[viewIndex],
        total: s.queue.length,
        answer: s.answers[String(s.queue[viewIndex])] || null,
    });
}

/**
 * 下一题：从回看回到进度；在进度题且已作答时可推进（背诵）
 */
export function next() {
    cancelScheduledAdvance();
    const s = getState().drillSession;
    if (!s) return err(ErrorCode.STATE_ERROR, '未在练习会话中');

    // 回看中 → 朝进度走
    if (s.viewIndex < s.progressIndex) {
        const viewIndex = s.viewIndex + 1;
        const session = { ...s, viewIndex };
        syncNavFromSession(session, 'drill-next');
        return ok({
            index: viewIndex,
            qId: s.queue[viewIndex],
            total: s.queue.length,
            backToProgress: viewIndex === s.progressIndex,
        });
    }

    // 已在进度题
    if (s.progressIndex >= s.queue.length) {
        return ok({ done: true, index: s.viewIndex, total: s.queue.length });
    }

    const qId = s.queue[s.progressIndex];
    const answered = !!s.answers[String(qId)];

    // 背诵：已答则可主动推进；快速：通常由 afterAnswer+advanceProgress，此处允许手动跳过等待
    if (answered || s.mode === 'quick') {
        if (s.progressIndex >= s.queue.length - 1 && answered) {
            return advanceProgress();
        }
        if (answered) {
            return advanceProgress();
        }
        // 快速未答：不强制跳过未答（避免空刷）；仍返回当前
        return ok({
            index: s.viewIndex,
            qId,
            total: s.queue.length,
            waitingAnswer: true,
        });
    }

    return ok({
        index: s.viewIndex,
        qId,
        total: s.queue.length,
        waitingAnswer: true,
    });
}

export const DrillAPI = {
    isActive,
    current,
    start,
    exit,
    recordAnswer,
    afterAnswer,
    advanceProgress,
    prev,
    next,
    buildPreferNoneQueue,
    cancelScheduledAdvance,
    scheduleAdvance,
    DEFAULT_COUNT,
};
