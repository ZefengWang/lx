/**
 * 错题本 UI ↔ API 契约（方案 B）
 *
 * 权威规则：错题本内「答对移出 / 我已掌握」必须走 WrongBookAPI.markMastered，
 * 禁止仅调用 ProgressAPI.setStatus（后者不会在 remaining===0 时自动 exit + CLEARED）。
 *
 * 页面（wrongbook.js）与测试共用本模块，避免 UI 行为与回归用例分叉。
 *
 * @module render/contracts/wrongbook-flow
 */

/**
 * 手动「我已掌握」的权威收尾
 * @param {object} LX window.LX
 * @param {object|string|number} q question 或 id
 * @returns {import('../../types.js').Result<{ remaining: number; cleared: boolean }>}
 */
export function markMasteredInWrongBook(LX, q) {
    return LX.WrongBookAPI.markMastered(q);
}

/**
 * 判分完成后的收尾：仅当答对时调用 markMastered
 * @param {object} LX
 * @param {object} q question 对象
 * @param {{ ok: boolean; data?: { correct?: boolean }; error?: object }} answerResult QuestionAPI.answer 的返回
 * @returns {{ answered: object; mark: object|null; cleared: boolean }}
 */
export function onWrongBookGraded(LX, q, answerResult) {
    if (!answerResult || answerResult.ok !== true) {
        return { answered: answerResult, mark: null, cleared: false };
    }
    if (!answerResult.data || answerResult.data.correct !== true) {
        return { answered: answerResult, mark: null, cleared: false };
    }
    const mark = markMasteredInWrongBook(LX, q);
    return {
        answered: answerResult,
        mark,
        cleared: !!(mark && mark.ok && mark.data && mark.data.cleared),
    };
}
